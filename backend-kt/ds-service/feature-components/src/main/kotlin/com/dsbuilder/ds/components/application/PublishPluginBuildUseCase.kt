package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.NewPluginBuild
import com.dsbuilder.ds.components.domain.PluginBuild
import com.dsbuilder.ds.components.domain.PreviewPluginPlatform
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.valueOr
import kotlinx.coroutines.CancellationException
import java.time.Instant

/**
 * Принимает архив плагина платформы и мету, кладёт файлы в хранилище платформы, импортирует мету и записывает билд
 * как активный билд платформы. Билды и файлы других платформ публикация и очистка не трогают.
 *
 * Файлы заливаются до транзакции БД: откат БД не оставляет активным билд без файлов, а оставшиеся без строки
 * каталоги убирает очистка. Роль публикации проверяется до разбора архива.
 */
class PublishPluginBuildUseCase(
    private val transactions: TransactionRunner,
    private val storages: PluginBuildStorages,
    private val builds: PluginBuildRepository,
    private val apiMeta: ApiMetaRepository,
) {
    /** Выполняет публикацию билда [platform]. */
    @Suppress("ReturnCount")
    suspend fun execute(
        platform: PreviewPluginPlatform,
        context: DsRequestContext,
        command: PublishPluginBuild,
    ): DsResult<PublishResult> {
        if (!context.principal.globalAdmin && !context.principal.composePreviewPublisher) {
            return DsResult.Failure(DsFailure.Forbidden)
        }
        if (CoreMetaValidation.missingMetadata(command.meta)) {
            return DsResult.Failure(
                DsFailure.InvalidRequest(
                    "CORE_RELEASE_METADATA_REQUIRED",
                    message = "Обновите CLI: нужны координаты Core и канал",
                ),
            )
        }
        val target = storages.configured(platform)
            ?.let { Target(platform, it.storage, it.settings) }
            ?: return DsResult.Failure(DsFailure.DependencyUnavailable(storageDependency(platform)))
        if (command.meta.platform != platform.wire) return DsResult.Failure(DsFailure.InvalidRequest(INVALID_BODY))
        val prepared = prepare(target, command.archive).valueOr { return it }
        val archive = prepared.archive
        val manifest = prepared.manifest
        if (!matchesCore(command.meta, prepared)) {
            return DsResult.Failure(DsFailure.InvalidRequest("CORE_PREVIEW_META_MISMATCH"))
        }
        val newBuild = NewPluginBuild(
            buildId = manifest.version,
            platform = platform.wire,
            libraryVersion = manifest.libraryVersion,
            metaSha256 = manifest.apiMetaSha256,
            commit = manifest.commit,
            protocolVersion = manifest.protocolVersion,
            zipSha256 = archive.sha256,
            sizeBytes = archive.uncompressedBytes,
            fileCount = archive.files.size,
            publishedBy = context.principal.actorId,
            coreRelease = manifest.coreRelease,
            storageKey = if (command.meta.channel == "dev") {
                "${manifest.version}-${archive.sha256}"
            } else {
                manifest.version
            },
        )
        return if (command.dryRun) dryRun(target, command, newBuild) else publish(target, command, archive, newBuild)
    }

    private fun matchesCore(meta: ImportApiMeta, prepared: Prepared): Boolean {
        val release = requireNotNull(meta.coreRelease)
        val manifest = prepared.manifest
        val coordinatesMatch = release == manifest.coreRelease
        val source = meta.sourceMetaBase64?.let {
            runCatching { java.util.Base64.getDecoder().decode(it) }.getOrNull()
        }
        val archived = prepared.archive.files.getValue(PluginManifestParser.META_FILE)
        val bytesMatch = source?.contentEquals(archived) == true
        return coordinatesMatch &&
            meta.metaSha256 == manifest.apiMetaSha256 && bytesMatch
    }

    /** Платформа публикации с её хранилищем и настройками. */
    private class Target(
        val platform: PreviewPluginPlatform,
        val storage: PluginBuildStorage,
        val settings: PluginBuildSettings,
    )

    private fun classify(
        existing: PluginBuild?,
        newBuild: NewPluginBuild,
        replace: Boolean,
    ): DsResult<PublishKind> {
        if (existing == null) return DsResult.Success(PublishKind.PUBLISHED)
        return when {
            existing.platform != newBuild.platform -> DsResult.Failure(
                DsFailure.Conflict(
                    code = BUILD_PLATFORM_CONFLICT,
                    message = "Билд ${existing.buildId} уже опубликован для платформы ${existing.platform}",
                ),
            )
            existing.zipSha256 != newBuild.zipSha256 -> classifyChanged(existing, newBuild, replace)
            existing.active -> DsResult.Success(PublishKind.UNCHANGED)
            else -> DsResult.Success(PublishKind.ACTIVATED)
        }
    }

    private fun classifyChanged(
        existing: PluginBuild,
        newBuild: NewPluginBuild,
        replace: Boolean,
    ): DsResult<PublishKind> = when {
        !replace -> DsResult.Failure(
            DsFailure.Conflict(
                code = BUILD_CONTENT_CHANGED,
                message = "Билд ${existing.buildId} уже опубликован с другим содержимым архива",
            ),
        )
        existing.libraryVersion != newBuild.libraryVersion || existing.metaSha256 != newBuild.metaSha256 ||
            existing.protocolVersion != newBuild.protocolVersion || existing.commit != newBuild.commit ->
            DsResult.Failure(DsFailure.Conflict("CORE_PREVIEW_META_MISMATCH"))
        else -> DsResult.Success(PublishKind.REPLACED)
    }

    /** Архив и manifest, прошедшие проверки. */
    private class Prepared(val archive: PluginArchive, val manifest: PluginManifest)

    @Suppress("ReturnCount")
    private fun prepare(target: Target, bytes: ByteArray): DsResult<Prepared> {
        val archive = when (val read = PluginArchiveReader.read(bytes, target.settings.limits)) {
            is PluginArchiveResult.Invalid -> return invalidRequest(read.code, read.message)
            is PluginArchiveResult.Valid -> read.archive
        }
        val manifest = when (val parsed = PluginManifestParser.parse(archive, target.platform)) {
            is PluginManifestResult.Invalid -> return invalidRequest(parsed.code, parsed.message)
            is PluginManifestResult.Valid -> parsed.manifest
        }
        return DsResult.Success(Prepared(archive, manifest))
    }

    private fun invalidRequest(code: String, message: String): DsResult<Prepared> =
        DsResult.Failure(DsFailure.InvalidRequest(code = code, message = message))

    @Suppress("ReturnCount")
    private suspend fun dryRun(
        target: Target,
        command: PublishPluginBuild,
        newBuild: NewPluginBuild,
    ): DsResult<PublishResult> {
        val existing = transactions.readOnly { DsResult.Success(builds.find(newBuild.buildId)) }.valueOr { return it }
        val kind = classify(existing, newBuild, command.meta.channel == "dev").valueOr { return it }
        if (kind == PublishKind.REPLACED) {
            transactions.readOnly { builds.validateReplacement(newBuild) }.valueOr { return it }
        }
        val predicted = if (kind == PublishKind.REPLACED) {
            predicted(replacement(newBuild))
        } else {
            existing ?: predicted(newBuild)
        }
        val report = transactions.rollback {
            apiMeta.import(command.meta.copy(dryRun = true)).toDsResult()
        }.valueOr { return it }
        return DsResult.Success(
            PublishResult(kind, predicted, target.settings.pluginUrl(predicted.storageKey), report),
        )
    }

    /**
     * Запись идёт под блокировкой реестра: существование билда проверяется и файлы заливаются уже внутри неё, поэтому
     * параллельная публикация того же `buildId` с другим архивом не перезапишет принятые файлы.
     */
    private suspend fun publish(
        target: Target,
        command: PublishPluginBuild,
        archive: PluginArchive,
        newBuild: NewPluginBuild,
    ): DsResult<PublishResult> {
        var obsolete: String? = null
        val written = transactions.required {
            builds.lockPublications()
            val existing = builds.find(newBuild.buildId)
            val kind = classify(existing, newBuild, command.meta.channel == "dev").valueOr { return@required it }
            if (kind == PublishKind.REPLACED) obsolete = existing?.storageKey
            register(target, command, archive, newBuild, existing, kind)
        }
        if (written is DsResult.Success) {
            obsolete?.let { discardUnused(target, it) }
            cleanup(target)
        } else {
            discardUnused(target, newBuild.storageKey)
        }
        return written
    }

    @Suppress("LongParameterList")
    private suspend fun register(
        target: Target,
        command: PublishPluginBuild,
        archive: PluginArchive,
        newBuild: NewPluginBuild,
        existing: PluginBuild?,
        kind: PublishKind,
    ): DsResult<PublishResult> {
        if (kind == PublishKind.REPLACED) return replace(target, command, archive, newBuild)
        if (existing == null) {
            val uploaded = upload(target, archive, newBuild.storageKey)
            if (uploaded is DsResult.Failure) return uploaded
        }
        return when (val report = apiMeta.import(command.meta.copy(dryRun = false)).toDsResult()) {
            is DsResult.Failure -> report
            is DsResult.Success -> {
                val build = if (existing == null) builds.insertActive(newBuild) else builds.activate(newBuild.buildId)
                DsResult.Success(PublishResult(kind, build, target.settings.pluginUrl(build.storageKey), report.value))
            }
        }
    }

    private fun replacement(build: NewPluginBuild) = build.copy(storageKey = "${build.buildId}-${build.zipSha256}")

    private suspend fun replace(
        target: Target,
        command: PublishPluginBuild,
        archive: PluginArchive,
        build: NewPluginBuild,
    ): DsResult<PublishResult> {
        // Барьер импорта платформы всегда берётся раньше эксклюзивного барьера Core.
        val report = apiMeta.import(command.meta.copy(dryRun = false)).toDsResult().valueOr { return it }
        builds.validateReplacement(build).valueOr { return it }
        val next = replacement(build)
        return when (val uploaded = upload(target, archive, next.storageKey)) {
            is DsResult.Failure -> uploaded
            is DsResult.Success -> {
                val saved = builds.replaceActive(next)
                DsResult.Success(
                    PublishResult(PublishKind.REPLACED, saved, target.settings.pluginUrl(saved.storageKey), report),
                )
            }
        }
    }

    private suspend fun discardUnused(target: Target, storageKey: String) {
        try {
            transactions.required {
                builds.lockPublications()
                if (builds.listByRecency(target.platform.wire).none { it.storageKey == storageKey }) {
                    discard(target, storageKey)
                }
                DsResult.Success(Unit)
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            // Повторит очистка осиротевших каталогов.
        }
    }

    private suspend fun upload(target: Target, archive: PluginArchive, buildId: String): DsResult<Unit> = try {
        archive.files.forEach { (path, bytes) ->
            target.storage.putFile(
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
        DsResult.Failure(DsFailure.DependencyUnavailable(storageDependency(target.platform)))
    }

    /**
     * Удаляет лишние билды и осиротевшие каталоги платформы под той же блокировкой, что и публикация: билд, который
     * в этот момент активируется откатом, не попадёт в удаление. Строка снимается раньше файлов, чтобы билд без файлов
     * нельзя было активировать; ошибки не влияют на результат публикации. Осиротевшие каталоги ищутся только
     * в хранилище платформы, поэтому файлы других платформ им не считаются.
     */
    @Suppress("TooGenericExceptionCaught")
    private suspend fun cleanup(target: Target) {
        val settings = target.settings
        try {
            val removed = mutableListOf<PluginBuild>()
            transactions.required {
                builds.lockPublications()
                val recent = builds.listByRecency(target.platform.wire)
                val pinned = builds.pinnedBuildIds()
                val inactive = recent.filterNot { it.active || it.buildId in pinned }
                val keep = (recent.filter(PluginBuild::active) + inactive.take(settings.keepBuilds))
                    .map { it.buildId }.toSet() + pinned
                recent.filter { it.buildId !in keep }.forEach { stale ->
                    if (builds.deleteIfUnpinned(stale.buildId)) removed.add(stale)
                }
                DsResult.Success(Unit)
            }
            // Реестр уже зафиксирован. Повторная регистрация держит ту же блокировку;
            // если она успела восстановить строку, её файлы не трогаем.
            transactions.required {
                builds.lockPublications()
                removed.forEach { old -> if (builds.find(old.buildId) == null) discard(target, old.storageKey) }
                val known = builds.listByRecency(target.platform.wire).map { it.storageKey }.toSet()
                val threshold = Instant.now().minus(settings.orphanGrace)
                target.storage.listBuilds().filter { it.buildId !in known && it.lastModified.isBefore(threshold) }
                    .forEach { discard(target, it.buildId) }
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
    private suspend fun discard(target: Target, buildId: String) {
        try {
            target.storage.deleteBuild(buildId)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            // Осиротевший каталог удалит следующая очистка после периода ожидания.
        }
    }

    private fun predicted(build: NewPluginBuild) = PluginBuild(
        buildId = build.buildId,
        platform = build.platform,
        libraryVersion = build.libraryVersion,
        metaSha256 = build.metaSha256,
        commit = build.commit,
        protocolVersion = build.protocolVersion,
        zipSha256 = build.zipSha256,
        sizeBytes = build.sizeBytes,
        fileCount = build.fileCount,
        publishedBy = build.publishedBy,
        publishedAt = Instant.now(),
        active = true,
        storageKey = build.storageKey,
    )

    /** Константы публикации. */
    companion object {
        /** Код конфликта содержимого билда. */
        const val BUILD_CONTENT_CHANGED = "BUILD_CONTENT_CHANGED"

        /** Код конфликта: `buildId` уже записан для другой платформы. */
        const val BUILD_PLATFORM_CONFLICT = "BUILD_PLATFORM_CONFLICT"

        /** Код отказа для меты чужой платформы, как у маршрута при негодном теле. */
        const val INVALID_BODY = "invalid_body"

        /** Имя недоступной зависимости: хранилище платформы (`compose-preview-storage`, `web-preview-storage`). */
        fun storageDependency(platform: PreviewPluginPlatform): String = "${platform.wire}-preview-storage"
    }
}
