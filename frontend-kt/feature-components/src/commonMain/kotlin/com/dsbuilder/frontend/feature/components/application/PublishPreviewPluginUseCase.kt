package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.DEFAULT_API_KEY_ENV
import com.dsbuilder.frontend.core.auth.SERVICE_ACCOUNT_CLIENT_ID_ENV
import com.dsbuilder.frontend.core.auth.SERVICE_ACCOUNT_CLIENT_SECRET_ENV
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.ResolvedApiUrl
import com.dsbuilder.frontend.core.network.WriteApiUrlResult
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaImportReport
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaNormalizationResult
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaNormalizer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import okio.ByteString.Companion.toByteString

/**
 * Отправляет билд preview plugin (Compose или web) на бэкенд: архив и нормализованную мету из него одним запросом.
 *
 * Файлы в хранилище и запись версий выполняет бэкенд. CLI проверяет архив локально по правилам своей платформы
 * (`platform` и версия библиотеки в manifest, sha256 меты должен совпасть с `apiMetaSha256`) и до обращения к
 * сети отказывает при любом несоответствии. Мета нормализуется тем же нормализатором платформы, что и в
 * `components import-api`. Как и там, команда требует явный API URL и по умолчанию делает пробную отправку.
 */
public class PublishPreviewPluginUseCase internal constructor(
    private val credentialProvider: CredentialProvider,
    private val apiUrlResolver: ApiUrlResolver,
    private val archiveSource: PreviewPluginArchiveSource,
    private val remoteSource: PreviewPluginRemoteSource,
    private val normalizers: Map<TargetPlatform, ApiMetaNormalizer>,
) {
    /**
     * Выполняет отправку.
     *
     * @param command параметры запуска.
     * @param onTarget вызывается после локальных проверок и до отправки: цель и состав печатаются заранее.
     */
    public suspend fun execute(
        command: PublishPreviewPluginCommand,
        onTarget: (PublishPreviewPluginTarget) -> Unit = {},
    ): PublishPreviewPluginResult {
        val prepared = when (val result = prepare(command)) {
            is Preparation.Rejected -> return PublishPreviewPluginResult.Failed(result.message)
            is Preparation.Ready -> result
        }
        val credential = when (val selected = resolveCredential(prepared.apiUrl)) {
            is CredentialResult.Failed -> return PublishPreviewPluginResult.Failed(selected.withHint(prepared.apiUrl))
            is CredentialResult.Selected -> selected.credential
        }
        val target = prepared.target(dryRun = !command.apply)
        onTarget(target)
        val remote = remoteSource.publish(
            PublishPreviewPluginRemoteCommand(
                platform = command.platform,
                apiUrl = ProjectApiUrl(prepared.apiUrl.value),
                credential = credential,
                archive = prepared.archive,
                manifest = prepared.normalized.manifest,
                source = META_FILE,
                dryRun = !command.apply,
            ),
        )
        return when (remote) {
            is PublishPreviewPluginRemoteResult.Failed -> PublishPreviewPluginResult.Failed(remote.message, target)
            is PublishPreviewPluginRemoteResult.Conflict -> PublishPreviewPluginResult.Conflict(remote.message, target)
            is PublishPreviewPluginRemoteResult.Published -> PublishPreviewPluginResult.Published(
                outcome = remote.outcome,
                buildId = remote.buildId,
                libraryVersion = remote.libraryVersion,
                pluginUrl = remote.pluginUrl,
                report = remote.report,
                target = target,
                dryRun = !command.apply,
            )
        }
    }

    /** Локальные проверки до обращения к сети: платформа, адрес, архив, manifest и мета. */
    private sealed interface Preparation {
        data class Rejected(val message: String) : Preparation

        class Ready(
            val platform: TargetPlatform,
            val apiUrl: ResolvedApiUrl,
            val archive: PreviewPluginArchive,
            val identity: ManifestCheck.Valid,
            val normalized: ApiMetaNormalizationResult.Normalized,
        ) : Preparation {
            fun target(dryRun: Boolean) = PublishPreviewPluginTarget(
                platform = platform,
                apiUrl = apiUrl,
                source = archive.path,
                buildId = identity.version,
                libraryVersion = identity.libraryVersion,
                componentCount = normalized.manifest.components.size,
                propertyCount = normalized.manifest.propertyCount,
                stateCount = normalized.manifest.stateCount,
                dryRun = dryRun,
            )
        }
    }

    @Suppress("ReturnCount")
    private fun prepare(command: PublishPreviewPluginCommand): Preparation {
        val rules = PLATFORM_RULES[command.platform]
        val normalizer = normalizers[command.platform]
        if (rules == null || normalizer == null) {
            return Preparation.Rejected(
                "Error: preview-plugin publish does not support platform '${command.platform.cliValue}'. " +
                    "Supported: ${SUPPORTED_PLATFORMS.joinToString { it.cliValue }}.",
            )
        }
        val apiUrl = when (val resolved = apiUrlResolver.resolveForWrite(command.apiUrlOverride)) {
            is WriteApiUrlResult.Rejected -> return Preparation.Rejected(resolved.message)
            is WriteApiUrlResult.Resolved -> resolved.url
        }
        val archive = when (val read = archiveSource.read(command.from)) {
            is PreviewPluginArchiveResult.Failed -> return Preparation.Rejected(read.message)
            is PreviewPluginArchiveResult.Read -> read.archive
        }
        val identity = when (val checked = checkManifest(archive, rules)) {
            is ManifestCheck.Invalid -> return Preparation.Rejected(checked.message)
            is ManifestCheck.Valid -> checked
        }
        val normalized = when (val result = normalizer.normalize(archive.metaBytes.decodeToString())) {
            is ApiMetaNormalizationResult.Invalid -> return Preparation.Rejected(
                "Error: cannot read $META_FILE of ${archive.path}: ${result.message}",
            )
            ApiMetaNormalizationResult.Empty -> return Preparation.Rejected(
                "Error: $META_FILE of ${archive.path} contains no components with parameters.",
            )
            is ApiMetaNormalizationResult.Normalized -> result
        }
        return Preparation.Ready(command.platform, apiUrl, archive, identity, normalized)
    }

    private sealed interface ManifestCheck {
        data class Valid(val version: String, val libraryVersion: String) : ManifestCheck

        data class Invalid(val message: String) : ManifestCheck
    }

    @Suppress("ReturnCount")
    private fun checkManifest(archive: PreviewPluginArchive, rules: PlatformRules): ManifestCheck {
        val root = runCatching { Json.parseToJsonElement(archive.manifestText) }.getOrNull() as? JsonObject
            ?: return ManifestCheck.Invalid("Error: $MANIFEST_FILE of ${archive.path} is not a JSON object.")
        fun text(name: String): String? = (root[name] as? JsonPrimitive)?.takeIf { it.isString }?.content
        val declaredPlatform = text("platform")
        if (declaredPlatform != rules.manifestPlatform && (rules.platformRequired || declaredPlatform != null)) {
            return ManifestCheck.Invalid(
                "Error: $MANIFEST_FILE of ${archive.path} is for platform '${declaredPlatform ?: "<none>"}', " +
                    "expected '${rules.manifestPlatform}'.",
            )
        }
        val version = text("version")
            ?: return ManifestCheck.Invalid("Error: $MANIFEST_FILE of ${archive.path} has no 'version'.")
        val library = text(rules.libraryVersionField)
            ?: return ManifestCheck.Invalid(
                "Error: $MANIFEST_FILE of ${archive.path} has no '${rules.libraryVersionField}'.",
            )
        val declared = text("apiMetaSha256")
            ?: return ManifestCheck.Invalid("Error: $MANIFEST_FILE of ${archive.path} has no 'apiMetaSha256'.")
        val actual = archive.metaBytes.toByteString().sha256().hex()
        if (declared != actual) {
            return ManifestCheck.Invalid(
                "Error: $META_FILE does not match the plugin build: apiMetaSha256 is $declared, " +
                    "the file has $actual.",
            )
        }
        return ManifestCheck.Valid(version, library)
    }

    /** Служебная учётка из окружения либо сессия администратора; ключ проекта не используется. */
    private suspend fun resolveCredential(apiUrl: ResolvedApiUrl): CredentialResult =
        credentialProvider.resolve(
            CredentialRequest(
                apiUrl = ProjectApiUrl(apiUrl.value),
                credentialEnvName = CredentialEnvName(DEFAULT_API_KEY_ENV),
                policy = CredentialPolicy.SERVICE_ACCOUNT_OR_USER_SESSION,
            ),
        )

    private fun CredentialResult.Failed.withHint(apiUrl: ResolvedApiUrl): String =
        if (code == AuthErrorCode.AUTH_REQUIRED) {
            "$message Set $SERVICE_ACCOUNT_CLIENT_ID_ENV and $SERVICE_ACCOUNT_CLIENT_SECRET_ENV, or run " +
                "`dsbuilder auth login --api-url ${apiUrl.value}` as a system administrator."
        } else {
            message
        }

    /**
     * Правила manifest платформы.
     *
     * @property manifestPlatform значение `platform` в `preview-plugin.json`.
     * @property platformRequired обязано ли поле `platform`: архивы Compose, собранные до его появления, его
     *   не содержат, поэтому для Compose проверяется только несовпадение.
     * @property libraryVersionField поле версии библиотеки компонентов.
     */
    private class PlatformRules(
        val manifestPlatform: String,
        val platformRequired: Boolean,
        val libraryVersionField: String,
    )

    private companion object {
        const val MANIFEST_FILE = "preview-plugin.json"
        const val META_FILE = "api-meta.json"

        val PLATFORM_RULES = mapOf(
            TargetPlatform.COMPOSE to PlatformRules("compose", platformRequired = false, "uikitComposeVersion"),
            TargetPlatform.REACT to PlatformRules("web", platformRequired = true, "plasmaNewHopeVersion"),
        )
        val SUPPORTED_PLATFORMS = PLATFORM_RULES.keys.toList()
    }
}

/**
 * Запрос на отправку билда плагина.
 *
 * @property platform платформа плагина: `compose` или `react` (web-плагин).
 * @property from путь архива плагина.
 * @property apply записывать ли билд; без этого выполняется пробная отправка.
 * @property apiUrlOverride backend API URL, переданный аргументом.
 */
public data class PublishPreviewPluginCommand(
    public val platform: TargetPlatform,
    public val from: String,
    public val apply: Boolean,
    public val apiUrlOverride: String? = null,
)

/**
 * Цель и состав отправки, печатаемые до запроса.
 *
 * @property platform платформа плагина.
 * @property apiUrl разрешённый backend API URL вместе с источником.
 * @property source абсолютный путь архива.
 * @property buildId идентификатор билда из manifest.
 * @property libraryVersion версия библиотеки компонентов из manifest: `uikit-compose` или `plasma-new-hope`.
 * @property componentCount число компонентов меты.
 * @property propertyCount число свойств меты.
 * @property stateCount число состояний меты.
 * @property dryRun пробная ли отправка.
 */
public data class PublishPreviewPluginTarget(
    public val platform: TargetPlatform,
    public val apiUrl: ResolvedApiUrl,
    public val source: String,
    public val buildId: String,
    public val libraryVersion: String,
    public val componentCount: Int,
    public val propertyCount: Int,
    public val stateCount: Int,
    public val dryRun: Boolean,
)

/** Результат отправки билда плагина. */
public sealed interface PublishPreviewPluginResult {
    /**
     * Backend принял запрос.
     *
     * @property outcome `published`, `activated` или `unchanged`.
     * @property buildId идентификатор билда.
     * @property libraryVersion версия библиотеки компонентов билда.
     * @property pluginUrl публичный адрес каталога билда.
     * @property report отчёт импорта меты.
     * @property target цель отправки.
     * @property dryRun была ли отправка пробной.
     */
    public data class Published(
        public val outcome: String,
        public val buildId: String,
        public val libraryVersion: String,
        public val pluginUrl: String,
        public val report: ApiMetaImportReport,
        public val target: PublishPreviewPluginTarget,
        public val dryRun: Boolean,
    ) : PublishPreviewPluginResult

    /**
     * Билд с тем же идентификатором опубликован с другим содержимым.
     *
     * @property message сообщение backend.
     * @property target цель отправки.
     */
    public data class Conflict(
        public val message: String,
        public val target: PublishPreviewPluginTarget,
    ) : PublishPreviewPluginResult

    /**
     * Отправка не выполнена.
     *
     * @property message детерминированное сообщение для вывода CLI.
     * @property target цель отправки, если дошло до неё.
     */
    public data class Failed(
        public val message: String,
        public val target: PublishPreviewPluginTarget? = null,
    ) : PublishPreviewPluginResult
}
