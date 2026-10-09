package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.DEFAULT_API_KEY_ENV
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
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaSkipped
import com.dsbuilder.frontend.feature.components.domain.apimeta.toApiMetaPlatform

/**
 * Заводит компоненты, свойства, состояния и платформенные имена в глобальном слое DS Builder по файлу
 * API-меты платформы.
 *
 * Операция административная и от проекта не зависит: нужны файл, платформа, явный API URL и user session
 * системного администратора. Роль проверяет сервер; CLI её не дублирует. Защита от записи не туда та же,
 * что у `components push`: явный API URL, печать цели и состава перед отправкой, dry run по умолчанию.
 */
public class ImportApiMetaUseCase internal constructor(
    private val credentialProvider: CredentialProvider,
    private val apiUrlResolver: ApiUrlResolver,
    private val metaSource: ApiMetaSource,
    private val remoteSource: ApiMetaRemoteSource,
    private val normalizers: Map<TargetPlatform, ApiMetaNormalizer>,
) {
    /**
     * Выполняет импорт и возвращает результат для вывода команды.
     *
     * Локальные отказы (платформа, URL, файл, формат) стоят до обращения к сети: так администратор узнаёт о
     * неверном файле раньше, чем обновится токен user session.
     *
     * @param command параметры запуска.
     * @param onTarget вызывается после подготовки манифеста и до отправки: печать цели и состава
     * манифеста должна предшествовать запросу, а не следовать за ним.
     */
    @Suppress("ReturnCount")
    public suspend fun execute(
        command: ImportApiMetaCommand,
        onTarget: (ImportApiMetaTarget) -> Unit = {},
    ): ImportApiMetaResult {
        val normalizer = normalizers[command.platform]
            ?: return ImportApiMetaResult.Failed(
                "Error: components import-api does not support platform '${command.platform.cliValue}' yet. " +
                    "Supported: ${normalizers.keys.joinToString { it.cliValue }}.",
            )

        val apiUrl = when (val resolved = apiUrlResolver.resolveForWrite(command.apiUrlOverride)) {
            is WriteApiUrlResult.Rejected -> return ImportApiMetaResult.Failed(resolved.message)
            is WriteApiUrlResult.Resolved -> resolved.url
        }

        val file = when (val read = metaSource.read(command.from)) {
            is ApiMetaSourceResult.Failed -> return ImportApiMetaResult.Failed(read.message)
            is ApiMetaSourceResult.Read -> read
        }

        val normalized = when (val result = normalizer.normalize(file.text, command.typeMap)) {
            is ApiMetaNormalizationResult.Invalid -> return ImportApiMetaResult.Failed(
                "Error: cannot read ${file.path}: ${result.message}",
            )
            ApiMetaNormalizationResult.Empty -> return ImportApiMetaResult.Failed(
                "Error: ${file.path} contains no components with parameters; it is not an API meta of " +
                    "platform '${command.platform.cliValue}' or it is empty.",
            )
            is ApiMetaNormalizationResult.Normalized -> result
        }

        val credential = when (val selected = resolveCredential(apiUrl)) {
            is CredentialResult.Failed -> return ImportApiMetaResult.Failed(selected.withLoginHint(apiUrl))
            is CredentialResult.Selected -> selected.credential
        }

        val target = ImportApiMetaTarget(
            apiUrl = apiUrl,
            platform = command.platform,
            source = file.path,
            componentCount = normalized.manifest.components.size,
            propertyCount = normalized.manifest.propertyCount,
            stateCount = normalized.manifest.stateCount,
        )
        onTarget(target)

        val imported = remoteSource.import(
            ImportApiMetaRemoteCommand(
                apiUrl = ProjectApiUrl(apiUrl.value),
                credential = credential,
                platform = command.platform.toApiMetaPlatform(),
                source = file.path.substringAfterLast('/').substringAfterLast('\\'),
                dryRun = command.dryRun,
                manifest = normalized.manifest,
            ),
        )

        return when (imported) {
            is ImportApiMetaRemoteResult.Failed -> ImportApiMetaResult.Failed(imported.message, target)
            is ImportApiMetaRemoteResult.Imported -> ImportApiMetaResult.Imported(
                report = imported.report,
                target = target,
                dryRun = command.dryRun,
                conflicts = normalized.conflicts,
                skipped = normalized.skipped,
            )
        }
    }

    /**
     * Credential команды — всегда user session. Принудительная политика обходит источники ключей, поэтому
     * ключ проекта из окружения не используется, а имя переменной нужно только для заполнения запроса.
     */
    private suspend fun resolveCredential(apiUrl: ResolvedApiUrl): CredentialResult =
        credentialProvider.resolve(
            CredentialRequest(
                apiUrl = ProjectApiUrl(apiUrl.value),
                credentialEnvName = CredentialEnvName(DEFAULT_API_KEY_ENV),
                policy = CredentialPolicy.USER_SESSION,
            ),
        )

    private fun CredentialResult.Failed.withLoginHint(apiUrl: ResolvedApiUrl): String =
        if (code == AuthErrorCode.AUTH_REQUIRED) {
            "$message Run `dsbuilder auth login --api-url ${apiUrl.value}` as a system administrator."
        } else {
            message
        }
}

/**
 * Запрос на выполнение импорта API-меты.
 *
 * @property platform платформа, чью мету импортируем.
 * @property from путь файла меты из `--from`.
 * @property dryRun выполнять ли импорт без сохранения изменений.
 * @property typeMap подмена типа свойства `from → to` до отправки.
 * @property apiUrlOverride backend API URL, переданный аргументом.
 */
public data class ImportApiMetaCommand(
    public val platform: TargetPlatform,
    public val from: String,
    public val dryRun: Boolean,
    public val typeMap: Map<String, String> = emptyMap(),
    public val apiUrlOverride: String? = null,
)

/**
 * Цель запроса и состав манифеста, печатаемые перед отправкой.
 *
 * @property apiUrl разрешённый backend API URL вместе с источником.
 * @property platform платформа, чья мета импортируется.
 * @property source абсолютный путь прочитанного файла меты.
 * @property componentCount число компонентов в манифесте.
 * @property propertyCount число свойств в манифесте.
 * @property stateCount число состояний в манифесте.
 */
public data class ImportApiMetaTarget(
    public val apiUrl: ResolvedApiUrl,
    public val platform: TargetPlatform,
    public val source: String,
    public val componentCount: Int,
    public val propertyCount: Int,
    public val stateCount: Int,
)

/**
 * Результат выполнения импорта API-меты.
 */
public sealed interface ImportApiMetaResult {
    /** Цель и состав манифеста, если они были разрешены до отказа. */
    public val target: ImportApiMetaTarget?

    /**
     * Backend принял запрос и вернул отчёт.
     *
     * @property report отчёт импорта.
     * @property target цель запроса и состав манифеста.
     * @property dryRun выполнялся ли импорт без сохранения изменений.
     * @property conflicts повторы свойства с другим типом внутри меты: побеждало первое вхождение.
     * @property skipped то, что нормализатор сознательно не включил в манифест, по категориям.
     */
    public data class Imported(
        public val report: ApiMetaImportReport,
        override val target: ImportApiMetaTarget,
        public val dryRun: Boolean,
        public val conflicts: List<String> = emptyList(),
        public val skipped: List<ApiMetaSkipped> = emptyList(),
    ) : ImportApiMetaResult

    /**
     * Импорт не выполнен.
     *
     * @property message deterministic сообщение для CLI output.
     * @property target цель запроса, если она была разрешена.
     */
    public data class Failed(
        public val message: String,
        override val target: ImportApiMetaTarget? = null,
    ) : ImportApiMetaResult
}
