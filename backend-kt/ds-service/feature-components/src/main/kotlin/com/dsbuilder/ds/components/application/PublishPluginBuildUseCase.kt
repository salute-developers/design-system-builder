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
        return if (command.dryRun) dryRun(command, newBuild) else publish(command, archive, newBuild)
    }

    private fun classify(existing: PluginBuild?, newBuild: NewPluginBuild): DsResult<PublishKind> = when {
        existing != null && existing.zipSha256 != newBuild.zipSha256 -> DsResult.Failure(
            DsFailure.Conflict(
                code = BUILD_CONTENT_CHANGED,
                message = "Билд ${existing.buildId} уже опубликован с другим содержимым архива",
            ),
        )
        existing == null -> DsResult.Success(PublishKind.PUBLISHED)
        existing.active -> DsResult.Success(PublishKind.UNCHANGED)
        else -> DsResult.Success(PublishKind.ACTIVATED)
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

    @Suppress("ReturnCount")
    private suspend fun dryRun(command: PublishPluginBuild, newBuild: NewPluginBuild): DsResult<PublishResult> {
        val existing = when (val found = transactions.readOnly { DsResult.Success(builds.find(newBuild.buildId)) }) {
            is DsResult.Failure -> return found
            is DsResult.Success -> found.value
        }
        val kind = when (val classified = classify(existing, newBuild)) {
            is DsResult.Failure -> return classified
            is DsResult.Success -> classified.value
        }
        return when (val reportResult = transactions.rollback { importMeta(command.meta.copy(dryRun = true)) }) {
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

    /**
     * Запись идёт под блокировкой реестра: существование билда проверяется и файлы заливаются уже внутри неё, поэтому
     * параллельная публикация того же `buildId` с другим архивом не перезапишет принятые файлы.
     */
    private suspend fun publish(
        command: PublishPluginBuild,
        archive: PluginArchive,
        newBuild: NewPluginBuild,
    ): DsResult<PublishResult> {
        val written = transactions.required {
            builds.lockPublications()
            val existing = builds.find(newBuild.buildId)
            when (val kind = classify(existing, newBuild)) {
                is DsResult.Failure -> kind
                is DsResult.Success -> register(command, archive, newBuild, existing, kind.value)
            }
        }
        if (written is DsResult.Success) cleanup()
        return written
    }

    private suspend fun register(
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
        return when (val report = importMeta(command.meta.copy(dryRun = false))) {
            is DsResult.Failure -> report
            is DsResult.Success -> {
                val build = if (existing == null) builds.insertActive(newBuild) else builds.activate(newBuild.buildId)
                DsResult.Success(PublishResult(kind, build, settings.pluginUrl(build.buildId), report.value))
            }
        }
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

    /**
     * Удаляет лишние билды и осиротевшие каталоги под той же блокировкой, что и публикация: билд, который в этот
     * момент активируется откатом, не попадёт в удаление. Строка снимается раньше файлов, чтобы билд без файлов
     * нельзя было активировать; ошибки не влияют на результат публикации.
     */
    @Suppress("TooGenericExceptionCaught")
    private suspend fun cleanup() {
        try {
            transactions.required {
                builds.lockPublications()
                val recent = builds.listByRecency(PLATFORM)
                val inactive = recent.filterNot(PluginBuild::active)
                val keep = (recent.filter(PluginBuild::active) + inactive.take(settings.keepBuilds))
                    .map { it.buildId }.toSet()
                recent.filter { it.buildId !in keep }.forEach { stale ->
                    builds.delete(stale.buildId)
                    discard(stale.buildId)
                }
                val known = recent.map { it.buildId }.toSet()
                val threshold = Instant.now().minus(settings.orphanGrace)
                storage.listBuilds().filter { it.buildId !in known && it.lastModified.isBefore(threshold) }
                    .forEach { discard(it.buildId) }
                DsResult.Success(Unit)
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            // Следующая публикация повторит очистку.
        }
    }

    /** Файлы без строки в реестре уже не используются: сбой удаления подберёт проверка осиротевших каталогов. */
    @Suppress("TooGenericExceptionCaught")
    private suspend fun discard(buildId: String) {
        try {
            storage.deleteBuild(buildId)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            // Осиротевший каталог удалит следующая очистка после периода ожидания.
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
