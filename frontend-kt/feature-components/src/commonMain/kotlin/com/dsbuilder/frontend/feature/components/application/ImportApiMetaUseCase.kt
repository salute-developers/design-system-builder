package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.ResolvedApiUrl
import com.dsbuilder.frontend.core.network.WriteApiUrlResult
import com.dsbuilder.frontend.core.platform.PlatformResolution
import com.dsbuilder.frontend.core.platform.PlatformResolver
import com.dsbuilder.frontend.core.platform.PlatformRunPlan
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaImportReport
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaNormalizationResult
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaNormalizer
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaSkipped
import com.dsbuilder.frontend.feature.components.domain.apimeta.toApiMetaPlatform

/**
 * Заводит компоненты, свойства, состояния и платформенные имена в глобальном слое DS Builder
 * по API-мете платформы проекта.
 *
 * Защита от записи не туда та же, что у `components push`: явный API URL, печать цели перед
 * отправкой и dry run по умолчанию. Тяжёлый шаг — запуск Gradle — стоит после всех отказов,
 * которые можно вычислить без него.
 */
public class ImportApiMetaUseCase internal constructor(
    private val projectContextReader: ProjectContextReader,
    private val credentialProvider: CredentialProvider,
    private val apiUrlResolver: ApiUrlResolver,
    private val metaSource: ApiMetaSource,
    private val remoteSource: ApiMetaRemoteSource,
    private val normalizers: Map<TargetPlatform, ApiMetaNormalizer>,
) {
    /**
     * Выполняет импорт и возвращает результат для вывода команды.
     *
     * @param command параметры запуска.
     * @param onPlan вызывается до запуска платформенного инструмента с разрешённым планом.
     * @param onTarget вызывается после подготовки манифеста и до отправки: печать цели и состава
     * манифеста должна предшествовать запросу, а не следовать за ним.
     */
    @Suppress("ReturnCount", "CyclomaticComplexMethod", "LongMethod")
    public suspend fun execute(
        command: ImportApiMetaCommand,
        onPlan: (PlatformRunPlan) -> Unit = {},
        onTarget: (ImportApiMetaTarget) -> Unit = {},
    ): ImportApiMetaResult {
        val found = when (val read = projectContextReader.requireContext(null)) {
            is ProjectContextReadResult.Failed -> return ImportApiMetaResult.Failed(read.message)
            is ProjectContextReadResult.Found -> read
        }
        val context = found.context

        val platform = when (val resolution = PlatformResolver.resolve(command.platform, context.platforms)) {
            is PlatformResolution.Failed -> return ImportApiMetaResult.Failed(resolution.message)
            is PlatformResolution.Resolved -> resolution.platform
        }
        val normalizer = normalizers[platform]
        if (normalizer == null) {
            return ImportApiMetaResult.Failed(
                "Error: components import-api does not support platform '${platform.cliValue}' yet. " +
                    "Supported: ${normalizers.keys.joinToString { it.cliValue }}.",
            )
        }

        val apiUrl = when (
            val resolved = apiUrlResolver.resolveForWrite(command.apiUrlOverride, found.projectEnvironment)
        ) {
            is WriteApiUrlResult.Rejected -> return ImportApiMetaResult.Failed(resolved.message)
            is WriteApiUrlResult.Resolved -> resolved.url
        }

        val credential = when (
            val selected = credentialProvider.resolve(
                CredentialRequest(
                    ProjectApiUrl(apiUrl.value),
                    command.apiKeyOverride,
                    context.credentialEnvName,
                    context.credentialPolicy,
                    found.projectEnvironment,
                ),
            )
        ) {
            is CredentialResult.Failed -> return ImportApiMetaResult.Failed(selected.message)
            is CredentialResult.Selected -> selected.credential
        }

        val source = when (val read = metaSource.read(platform, command.toolOverride, onPlan)) {
            is ApiMetaSourceResult.Failed -> return ImportApiMetaResult.Failed(read.message)
            is ApiMetaSourceResult.Read -> read
        }

        val normalized = when (val result = normalizer.normalize(source.text, command.typeMap)) {
            is ApiMetaNormalizationResult.Invalid -> return ImportApiMetaResult.Failed(
                "Error: cannot read ${source.path}: ${result.message}",
            )
            ApiMetaNormalizationResult.Empty -> return ImportApiMetaResult.Failed(
                "Error: ${source.path} contains no components. The uikit artifact was not found on the " +
                    "classpath of the project; check that the dsBuilder plugin is applied and the module " +
                    "depends on the uikit library.",
            )
            is ApiMetaNormalizationResult.Normalized -> result
        }

        val target = ImportApiMetaTarget(
            apiUrl = apiUrl,
            projectId = context.projectId.value,
            designSystemId = context.designSystemId.value,
            platform = platform,
            source = source.path,
            componentCount = normalized.manifest.components.size,
            propertyCount = normalized.manifest.propertyCount,
            stateCount = normalized.manifest.stateCount,
        )

        onTarget(target)

        val imported = remoteSource.import(
            ImportApiMetaRemoteCommand(
                apiUrl = ProjectApiUrl(apiUrl.value),
                credential = credential,
                projectId = context.projectId,
                designSystemId = context.designSystemId,
                platform = platform.toApiMetaPlatform(),
                source = source.path,
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
}

/**
 * Запрос на выполнение импорта API-меты.
 *
 * @property platform платформа из `--platform`; `null` — взять из project config.
 * @property dryRun выполнять ли импорт без сохранения изменений.
 * @property typeMap подмена типа свойства `from → to` до отправки.
 * @property apiKeyOverride API key, переданный аргументом.
 * @property apiUrlOverride backend API URL, переданный аргументом.
 * @property toolOverride путь инструмента из `--tool`.
 */
public data class ImportApiMetaCommand(
    public val platform: TargetPlatform? = null,
    public val dryRun: Boolean,
    public val typeMap: Map<String, String> = emptyMap(),
    public val apiKeyOverride: String? = null,
    public val apiUrlOverride: String? = null,
    public val toolOverride: String? = null,
)

/**
 * Цель запроса и состав манифеста, печатаемые перед отправкой.
 *
 * @property apiUrl разрешённый backend API URL вместе с источником.
 * @property projectId идентификатор проекта.
 * @property designSystemId идентификатор дизайн-системы.
 * @property platform платформа, чья мета импортируется.
 * @property source путь прочитанного файла меты.
 * @property componentCount число компонентов в манифесте.
 * @property propertyCount число свойств в манифесте.
 * @property stateCount число состояний в манифесте.
 */
public data class ImportApiMetaTarget(
    public val apiUrl: ResolvedApiUrl,
    public val projectId: String,
    public val designSystemId: String,
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
