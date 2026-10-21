package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ApiMetaImportReport
import com.dsbuilder.ds.components.domain.NewPluginBuild
import com.dsbuilder.ds.components.domain.PluginBuild
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import kotlinx.coroutines.CancellationException
import java.time.Instant

/**
 * Принимает архив плагина и мету, кладёт файлы в хранилище, импортирует мету и записывает билд как активный.
 *
 * Файлы заливаются до транзакции БД: откат БД не оставляет активным билд без файлов, а оставшиеся без строки
 * каталоги убирает очистка. Роль публикации проверяется до разбора архива.
 */
class PublishPluginBuildUseCase(
    private val transactions: TransactionRunner,
    private val storage: PluginBuildStorage,
    private val builds: PluginBuildRepository,
    private val apiMeta: ApiMetaRepository,
    private val settings: PluginBuildSettings,
) {
    /** Выполняет публикацию. */
    @Suppress("ReturnCount")
    suspend fun execute(context: DsRequestContext, command: PublishPluginBuild): DsResult<PublishResult> {
        if (!context.principal.systemAdmin && !context.principal.composePreviewPublisher) {
            return DsResult.Failure(DsFailure.Forbidden)
        }
        if (!storage.configured) return DsResult.Failure(DsFailure.DependencyUnavailable(STORAGE_DEPENDENCY))
        val prepared = when (val result = prepare(command.archive)) {
            is DsResult.Failure -> return result
            is DsResult.Success -> result.value
        }
        val archive = prepared.archive
        val manifest = prepared.manifest
        val newBuild = NewPluginBuild(
            buildId = manifest.version,
            platform = PLATFORM,
            uikitComposeVersion = manifest.uikitComposeVersion,
            metaSha256 = manifest.apiMetaSha256,
            commit = manifest.commit,
            protocolVersion = manifest.protocolVersion,
            zipSha256 = archive.sha256,
            sizeBytes = archive.uncompressedBytes,
            fileCount = archive.files.size,
            publishedBy = context.principal.actorId,
        )
        val existing = when (val found = transactions.readOnly { DsResult.Success(builds.find(newBuild.buildId)) }) {
            is DsResult.Failure -> return found
            is DsResult.Success -> found.value
        }
        if (existing != null && existing.zipSha256 != newBuild.zipSha256) {
            return DsResult.Failure(
                DsFailure.Conflict(
                    code = BUILD_CONTENT_CHANGED,
                    message = "Билд ${existing.buildId} уже опубликован с другим содержимым архива",
                ),
            )
        }
        val kind = when {
            existing == null -> PublishKind.PUBLISHED
            existing.active -> PublishKind.UNCHANGED
            else -> PublishKind.ACTIVATED
        }
        return if (command.dryRun) {
            dryRun(command, newBuild, existing, kind)
        } else {
            publish(command, archive, newBuild, existing, kind)
        }
    }

    /** Архив и manifest, прошедшие проверки. */
    private class Prepared(val archive: PluginArchive, val manifest: PluginManifest)

    @Suppress("ReturnCount")
    private fun prepare(bytes: ByteArray): DsResult<Prepared> {
        val archive = when (val read = PluginArchiveReader.read(bytes, settings.limits)) {
            is PluginArchiveResult.Invalid -> return invalidRequest(read.code, read.message)
            is PluginArchiveResult.Valid -> read.archive
        }
        val manifest = when (val parsed = PluginManifestParser.parse(archive)) {
            is PluginManifestResult.Invalid -> return invalidRequest(parsed.code, parsed.message)
            is PluginManifestResult.Valid -> parsed.manifest
        }
        return DsResult.Success(Prepared(archive, manifest))
    }

    private fun invalidRequest(code: String, message: String): DsResult<Prepared> =
        DsResult.Failure(DsFailure.InvalidRequest(code = code, message = message))

    private suspend fun dryRun(
        command: PublishPluginBuild,
        newBuild: NewPluginBuild,
        existing: PluginBuild?,
        kind: PublishKind,
    ): DsResult<PublishResult> {
        val reportResult = transactions.rollback { importMeta(command.meta.copy(dryRun = true)) }
        return when (reportResult) {
            is DsResult.Failure -> reportResult
            is DsResult.Success -> DsResult.Success(
                PublishResult(
                    kind,
                    existing ?: predicted(newBuild),
                    settings.pluginUrl(newBuild.buildId),
                    reportResult.value,
                ),
            )
        }
    }

    private suspend fun publish(
        command: PublishPluginBuild,
        archive: PluginArchive,
        newBuild: NewPluginBuild,
        existing: PluginBuild?,
        kind: PublishKind,
    ): DsResult<PublishResult> {
        if (existing == null) {
            val uploaded = upload(archive, newBuild.buildId)
            if (uploaded is DsResult.Failure) return uploaded
        }
        val written = transactions.required {
            when (val report = importMeta(command.meta.copy(dryRun = false))) {
                is DsResult.Failure -> report
                is DsResult.Success -> {
                    val build = if (existing == null) {
                        builds.insertActive(newBuild)
                    } else {
                        builds.activate(newBuild.buildId)
                    }
                    DsResult.Success(PublishResult(kind, build, settings.pluginUrl(build.buildId), report.value))
                }
            }
        }
        if (written is DsResult.Success) cleanup()
        return written
    }

    private suspend fun upload(archive: PluginArchive, buildId: String): DsResult<Unit> = try {
        archive.files.forEach { (path, bytes) ->
            storage.putFile(
                buildId,
                path,
                bytes,
                PluginContentTypes.forPath(path),
                PluginContentTypes.IMMUTABLE_CACHE_CONTROL,
            )
        }
        DsResult.Success(Unit)
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        DsResult.Failure(DsFailure.DependencyUnavailable(STORAGE_DEPENDENCY))
    }

    private suspend fun importMeta(meta: ImportApiMeta): DsResult<ApiMetaImportReport> =
        when (val attempt = apiMeta.import(meta)) {
            is ApiMetaRepository.ImportAttempt.Success -> DsResult.Success(attempt.value)
            is ApiMetaRepository.ImportAttempt.Failed ->
                DsResult.Failure(DsFailure.Unprocessable("Import failed", attempt.reason))
        }

    /** Удаляет лишние билды и осиротевшие каталоги; ошибки не влияют на результат публикации. */
    @Suppress("TooGenericExceptionCaught")
    private suspend fun cleanup() {
        try {
            val listed = transactions.readOnly { DsResult.Success(builds.listByRecency(PLATFORM)) }
            val recent = (listed as? DsResult.Success)?.value ?: return
            val inactive = recent.filterNot(PluginBuild::active)
            val keep = (recent.filter(PluginBuild::active) + inactive.take(settings.keepBuilds))
                .map { it.buildId }.toSet()
            recent.filter { it.buildId !in keep }.forEach { stale ->
                storage.deleteBuild(stale.buildId)
                transactions.required {
                    builds.delete(stale.buildId)
                    DsResult.Success(Unit)
                }
            }
            val known = recent.map { it.buildId }.toSet()
            val threshold = Instant.now().minus(settings.orphanGrace)
            storage.listBuilds().filter { it.buildId !in known && it.lastModified.isBefore(threshold) }
                .forEach { storage.deleteBuild(it.buildId) }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            // Следующая публикация повторит очистку.
        }
    }

    private fun predicted(build: NewPluginBuild) = PluginBuild(
        buildId = build.buildId,
        platform = build.platform,
        uikitComposeVersion = build.uikitComposeVersion,
        metaSha256 = build.metaSha256,
        commit = build.commit,
        protocolVersion = build.protocolVersion,
        zipSha256 = build.zipSha256,
        sizeBytes = build.sizeBytes,
        fileCount = build.fileCount,
        publishedBy = build.publishedBy,
        publishedAt = Instant.now(),
        active = true,
    )

    /** Константы публикации. */
    companion object {
        /** Платформа реестра. */
        const val PLATFORM = "compose"

        /** Код конфликта содержимого билда. */
        const val BUILD_CONTENT_CHANGED = "BUILD_CONTENT_CHANGED"

        /** Имя недоступной зависимости. */
        const val STORAGE_DEPENDENCY = "compose-preview-storage"
    }
}
