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
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.ResolvedApiUrl
import com.dsbuilder.frontend.core.network.WriteApiUrlResult
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifest

/**
 * Отправляет каталог иконок на бэкенд: собирает манифест из каталога пакета `@salutejs/sdds-icons` (или читает
 * готовый `icons-manifest.json`) и передаёт его одним запросом.
 *
 * Хранение SVG, различия, защиту используемых иконок и сверку значений выполняет бэкенд. CLI проверяет только
 * источник и формат до обращения к сети и по умолчанию делает пробную отправку. Как и `preview-plugin publish`,
 * команда требует явный API URL и входит служебной учёткой либо сессией администратора; проектный `.sdds` и `.env`
 * не читаются.
 */
public class PublishIconCatalogUseCase internal constructor(
    private val credentialProvider: CredentialProvider,
    private val apiUrlResolver: ApiUrlResolver,
    private val manifestStore: IconManifestStore,
    private val remoteSource: IconCatalogRemoteSource,
) {
    /**
     * Выполняет отправку.
     *
     * @param command параметры запуска.
     * @param onTarget вызывается после локальных проверок и до отправки: цель и предупреждения печатаются заранее.
     */
    @Suppress("ReturnCount")
    public suspend fun execute(
        command: PublishIconCatalogCommand,
        onTarget: (PublishIconCatalogTarget) -> Unit = {},
    ): PublishIconCatalogResult {
        val prepared = when (val result = prepare(command)) {
            is Preparation.Rejected -> return PublishIconCatalogResult.Failed(result.message)
            is Preparation.Ready -> result
        }
        val credential = when (val selected = resolveCredential(prepared.apiUrl)) {
            is CredentialResult.Failed -> return PublishIconCatalogResult.Failed(selected.withHint(prepared.apiUrl))
            is CredentialResult.Selected -> selected.credential
        }
        val dryRun = !command.apply
        val target = prepared.target(dryRun)
        onTarget(target)
        val remote = remoteSource.publish(
            PublishIconCatalogRemoteCommand(
                apiUrl = ProjectApiUrl(prepared.apiUrl.value),
                credential = credential,
                manifest = prepared.manifest,
                dryRun = dryRun,
                allowRemovingUsed = command.allowRemovingUsed,
            ),
        )
        return when (remote) {
            is PublishIconCatalogRemoteResult.Failed -> PublishIconCatalogResult.Failed(remote.message, target)
            is PublishIconCatalogRemoteResult.InUse ->
                PublishIconCatalogResult.InUse(remote.items, remote.message, target)
            is PublishIconCatalogRemoteResult.Published ->
                PublishIconCatalogResult.Published(remote.report, target, dryRun)
        }
    }

    /** Локальные проверки до обращения к сети: источник, адрес, манифест. */
    private sealed interface Preparation {
        data class Rejected(val message: String) : Preparation

        class Ready(
            val apiUrl: ResolvedApiUrl,
            val manifest: IconManifest,
            val source: String,
            val warnings: List<String>,
        ) : Preparation {
            fun target(dryRun: Boolean) = PublishIconCatalogTarget(
                apiUrl = apiUrl,
                source = source,
                packageName = manifest.source.packageName,
                packageVersion = manifest.source.version,
                iconCount = manifest.icons.size,
                sizeCounts = manifest.sizeCounts(),
                warnings = warnings,
                dryRun = dryRun,
            )
        }
    }

    @Suppress("ReturnCount")
    private fun prepare(command: PublishIconCatalogCommand): Preparation {
        if ((command.fromDir == null) == (command.from == null)) {
            return Preparation.Rejected("Error: pass exactly one of --from-dir and --from.")
        }
        if (command.writeManifest != null && command.fromDir == null) {
            return Preparation.Rejected("Error: --write-manifest requires --from-dir.")
        }
        val apiUrl = when (val resolved = apiUrlResolver.resolveForWrite(command.apiUrlOverride)) {
            is WriteApiUrlResult.Rejected -> return Preparation.Rejected(resolved.message)
            is WriteApiUrlResult.Resolved -> resolved.url
        }
        val read = if (command.fromDir != null) {
            manifestStore.fromDirectory(command.fromDir, command.packageVersion)
        } else {
            manifestStore.fromManifest(requireNotNull(command.from))
        }
        val (manifest, warnings) = when (read) {
            is IconManifestReadResult.Failed -> return Preparation.Rejected(read.message)
            is IconManifestReadResult.Read -> read.manifest.withVersion(command.packageVersion) to read.warnings
        }
        val written = command.writeManifest?.let { manifestStore.write(it, manifest) }
        if (written != null) return Preparation.Rejected(written)
        return Preparation.Ready(apiUrl, manifest, command.fromDir ?: requireNotNull(command.from), warnings)
    }

    private fun IconManifest.withVersion(version: String?): IconManifest =
        if (version == null) this else copy(source = source.copy(version = version))

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
}

/**
 * Запрос на отправку каталога иконок.
 *
 * @property fromDir корень пакета `@salutejs/sdds-icons` с подкаталогами `svg/16`, `svg/24`, `svg/36`.
 * @property from готовый `icons-manifest.json`; задаётся вместо [fromDir].
 * @property packageVersion версия пакета-источника; переопределяет версию из `package.json` и манифеста.
 * @property writeManifest файл, в который записать собранный манифест (только вместе с [fromDir]).
 * @property allowRemovingUsed разрешить удаление иконок, на которые есть ссылки в конфигурациях.
 * @property apply записывать ли каталог; без этого выполняется пробная отправка.
 * @property apiUrlOverride backend API URL, переданный аргументом.
 */
public data class PublishIconCatalogCommand(
    public val fromDir: String? = null,
    public val from: String? = null,
    public val packageVersion: String? = null,
    public val writeManifest: String? = null,
    public val allowRemovingUsed: Boolean = false,
    public val apply: Boolean = false,
    public val apiUrlOverride: String? = null,
)

/**
 * Цель и состав отправки, печатаемые до запроса.
 *
 * @property apiUrl разрешённый backend API URL вместе с источником.
 * @property source каталог или манифест, откуда взяты иконки.
 * @property packageName пакет-источник.
 * @property packageVersion версия пакета-источника или `unknown`.
 * @property iconCount число иконок.
 * @property sizeCounts размер → число иконок с этим размером.
 * @property warnings предупреждения чтения источника.
 * @property dryRun пробная ли отправка.
 */
public data class PublishIconCatalogTarget(
    public val apiUrl: ResolvedApiUrl,
    public val source: String,
    public val packageName: String,
    public val packageVersion: String,
    public val iconCount: Int,
    public val sizeCounts: Map<Int, Int>,
    public val warnings: List<String>,
    public val dryRun: Boolean,
)

/** Результат отправки каталога иконок. */
public sealed interface PublishIconCatalogResult {
    /**
     * Backend принял запрос.
     *
     * @property report отчёт бэкенда.
     * @property target цель отправки.
     * @property dryRun была ли отправка пробной.
     */
    public data class Published(
        public val report: IconCatalogReport,
        public val target: PublishIconCatalogTarget,
        public val dryRun: Boolean,
    ) : PublishIconCatalogResult

    /**
     * Загрузка удаляет используемые иконки; для разрешения нужен `--allow-removing-used`.
     *
     * @property items иконки, размеры и число ссылок.
     * @property message сообщение backend.
     * @property target цель отправки.
     */
    public data class InUse(
        public val items: List<IconInUse>,
        public val message: String,
        public val target: PublishIconCatalogTarget,
    ) : PublishIconCatalogResult

    /**
     * Отправка не выполнена.
     *
     * @property message детерминированное сообщение для вывода CLI.
     * @property target цель отправки, если дошло до неё.
     */
    public data class Failed(
        public val message: String,
        public val target: PublishIconCatalogTarget? = null,
    ) : PublishIconCatalogResult
}
