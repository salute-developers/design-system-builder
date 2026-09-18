package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.ResolvedApiUrl
import com.dsbuilder.frontend.core.network.WriteApiUrlResult
import com.dsbuilder.frontend.feature.components.domain.ComponentImportReport
import com.dsbuilder.frontend.feature.components.domain.ComponentPackage
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageResult
import com.dsbuilder.frontend.feature.components.domain.ConvertedComponentConfig
import com.dsbuilder.frontend.feature.components.domain.codec.ConfigCodec
import com.dsbuilder.frontend.feature.components.domain.codec.ConfigCodecResult

/**
 * Загружает конфигурации компонентов дизайн-системы в DS Builder одним запросом.
 *
 * Сверка имени дизайн-системы не выполняется: сопоставимое поле на стороне backend не
 * установлено. Защита от записи не туда держится на явном API URL, печати цели и состава
 * пакета перед отправкой и режиме dry run по умолчанию.
 */
public class PushComponentsUseCase internal constructor(
    private val projectContextReader: ProjectContextReader,
    private val credentialProvider: CredentialProvider,
    private val apiUrlResolver: ApiUrlResolver,
    private val componentPackageLoader: ComponentPackageLoader,
    private val remoteSource: ComponentConfigRemoteSource,
    private val codec: ConfigCodec,
) {
    /**
     * Выполняет push и возвращает результат для вывода команды.
     *
     * Ранние возвраты соответствуют барьерам перед записью: явный API URL, project context,
     * credentials, чтение пакета, преобразование. Каждый отказывает со своей диагностикой и, что
     * важнее, до отправки запроса.
     */
    @Suppress("ReturnCount", "CyclomaticComplexMethod", "LongMethod")
    public suspend fun execute(command: PushComponentsCommand): PushComponentsResult {
        val found = when (
            val read = projectContextReader.requireContext(null, command.designSystemUri, command.projectKeyEnvName)
        ) {
            is ProjectContextReadResult.Failed -> return PushComponentsResult.Failed(read.message)
            is ProjectContextReadResult.Found -> read
        }
        val context = found.context
        if (context.configPath.isBlank() && command.source.directory == null) {
            return PushComponentsResult.Failed("--from is required with --design-system.")
        }
        val apiUrl = when (
            val resolved = apiUrlResolver.resolveForWrite(command.apiUrlOverride, found.projectEnvironment)
        ) {
            is WriteApiUrlResult.Rejected -> return PushComponentsResult.Failed(resolved.message)
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
            is CredentialResult.Failed -> return PushComponentsResult.Failed(selected.message)
            is CredentialResult.Selected -> selected.credential
        }

        val componentPackage = when (val loaded = componentPackageLoader.load(command.source, context)) {
            is ComponentPackageResult.Failed -> return PushComponentsResult.Failed(loaded.message)
            is ComponentPackageResult.Loaded -> loaded.value
        }

        val target = PushTarget(
            apiUrl = apiUrl,
            projectId = context.projectId.value,
            designSystemId = context.designSystemId.value,
            packageName = componentPackage.name,
            packageOrigin = componentPackage.origin,
            configurationCount = componentPackage.configurations.size,
        )

        val converted = when (val conversion = convert(componentPackage)) {
            is ConversionResult.Rejected -> return PushComponentsResult.Failed(conversion.message, target)
            is ConversionResult.Converted -> conversion.components
        }

        val imported = remoteSource.import(
            ImportComponentsCommand(
                apiUrl = ProjectApiUrl(apiUrl.value),
                credential = credential,
                projectId = context.projectId,
                designSystemId = context.designSystemId,
                packageName = componentPackage.name,
                packageOrigin = componentPackage.origin,
                dryRun = command.dryRun,
                components = converted,
            ),
        )

        return when (imported) {
            is ImportComponentsResult.Failed -> PushComponentsResult.Failed(imported.message, target)
            is ImportComponentsResult.Imported -> PushComponentsResult.Pushed(
                report = imported.report,
                target = target,
                dryRun = command.dryRun,
            )
        }
    }

    /**
     * Преобразует весь пакет и отказывает на первой же неудаче.
     *
     * Частичная загрузка компонентной модели хуже отказа, поэтому одна некорректная
     * конфигурация отменяет push целиком. Диагностика называет компонент, стиль и файл.
     */
    private fun convert(componentPackage: ComponentPackage): ConversionResult {
        val converted = mutableListOf<ConvertedComponentConfig>()
        componentPackage.configurations.forEach { configuration ->
            when (val result = codec.decode(configuration.nativeConfig)) {
                is ConfigCodecResult.Failure -> return ConversionResult.Rejected(
                    "Error: cannot convert '${configuration.componentName}' " +
                        "(style '${configuration.styleName}', file '${configuration.fileName}'): " +
                        result.reason.message,
                )
                is ConfigCodecResult.Success -> converted += ConvertedComponentConfig(
                    componentName = configuration.componentName,
                    styleName = configuration.styleName,
                    config = result.value,
                )
            }
        }
        return ConversionResult.Converted(converted)
    }
}

/**
 * Результат преобразования пакета в common-формат.
 */
private sealed interface ConversionResult {
    data class Converted(val components: List<ConvertedComponentConfig>) : ConversionResult

    data class Rejected(val message: String) : ConversionResult
}

/**
 * Запрос на выполнение push.
 *
 * @property source откуда брать пакет.
 * @property dryRun выполнять ли импорт без сохранения изменений.
 * @property apiKeyOverride API key, переданный аргументом.
 * @property apiUrlOverride backend API URL, переданный аргументом.
 * @property designSystemUri явная ссылка на дизайн-систему.
 * @property projectKeyEnvName env-переменная ключа для явной ссылки.
 */
public data class PushComponentsCommand(
    public val source: ComponentSource,
    public val dryRun: Boolean,
    public val apiKeyOverride: String? = null,
    public val apiUrlOverride: String? = null,
    public val designSystemUri: String? = null,
    public val projectKeyEnvName: String? = null,
)

/**
 * Цель запроса и состав пакета, печатаемые перед отправкой.
 *
 * Обе стороны показываются рядом, потому что автоматической сверки имён нет.
 *
 * @property apiUrl разрешённый backend API URL вместе с источником.
 * @property projectId идентификатор проекта.
 * @property designSystemId идентификатор дизайн-системы.
 * @property packageName имя из `meta.json`.
 * @property packageOrigin разрешённый источник пакета.
 * @property configurationCount число конфигураций в пакете.
 */
public data class PushTarget(
    public val apiUrl: ResolvedApiUrl,
    public val projectId: String,
    public val designSystemId: String,
    public val packageName: String,
    public val packageOrigin: String,
    public val configurationCount: Int,
)

/**
 * Результат выполнения push.
 */
public sealed interface PushComponentsResult {
    /**
     * Цель и состав пакета, если они были разрешены до отказа.
     */
    public val target: PushTarget?

    /**
     * Backend принял запрос и вернул отчёт.
     *
     * @property report отчёт импорта.
     * @property target цель запроса и состав пакета.
     * @property dryRun выполнялся ли импорт без сохранения изменений.
     */
    public data class Pushed(
        public val report: ComponentImportReport,
        override val target: PushTarget,
        public val dryRun: Boolean,
    ) : PushComponentsResult

    /**
     * Push не выполнен.
     *
     * @property message deterministic сообщение для CLI output.
     * @property target цель запроса, если она была разрешена.
     */
    public data class Failed(
        public val message: String,
        override val target: PushTarget? = null,
    ) : PushComponentsResult
}
