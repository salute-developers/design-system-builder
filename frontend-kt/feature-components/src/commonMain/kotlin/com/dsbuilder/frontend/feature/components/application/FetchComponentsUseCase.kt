package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.core.application.ProjectApiKeyResult
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.ResolvedApiUrl
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageWritePlanBuilder
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageWritePlanResult
import com.dsbuilder.frontend.feature.components.domain.ExportedComponentPackage
import com.dsbuilder.frontend.feature.components.domain.RenderedComponentConfig
import com.dsbuilder.frontend.feature.components.domain.codec.ConfigCodec
import com.dsbuilder.frontend.feature.components.domain.codec.ConfigCodecResult

/**
 * Выгружает конфигурации компонентов дизайн-системы в рабочую копию.
 *
 * Обратное направление к push: там модель наполняется из репозитория, здесь репозиторий
 * наполняется из модели. Без него контур разомкнут — правка, сделанная в web-клиенте,
 * остаётся в базе.
 */
public class FetchComponentsUseCase internal constructor(
    private val projectContextReader: ProjectContextReader,
    private val projectApiKeyProvider: ProjectApiKeyProvider,
    private val apiUrlResolver: ApiUrlResolver,
    private val remoteSource: ComponentConfigRemoteSource,
    private val directoryReader: ComponentPackageDirectoryReader,
    private val writer: LocalComponentPackageWriter,
    private val codec: ConfigCodec,
    private val planBuilder: ComponentPackageWritePlanBuilder = ComponentPackageWritePlanBuilder(),
) {
    /**
     * Выполняет fetch и возвращает результат для вывода команды.
     *
     * Порядок барьеров тот же, что у push, и он существенен: всё, что может отказать,
     * отказывает до первой записи в рабочую копию. Преобразование кодеком идёт раньше чтения
     * директории, потому что неконвертируемая конфигурация — отказ всей выгрузки, и трогать
     * из-за неё файлы незачем.
     */
    @Suppress("ReturnCount")
    public fun execute(command: FetchComponentsCommand): FetchComponentsResult {
        val apiUrl = apiUrlResolver.resolve(command.apiUrlOverride)

        val context = when (val read = projectContextReader.requireContext()) {
            is ProjectContextReadResult.Failed -> return FetchComponentsResult.Failed(read.message)
            is ProjectContextReadResult.Found -> read.context
        }

        val apiKey = when (val key = projectApiKeyProvider.resolve(command.apiKeyOverride, context.credentialEnvName)) {
            is ProjectApiKeyResult.Missing -> return FetchComponentsResult.Failed(key.message)
            is ProjectApiKeyResult.Found -> key.value
        }

        val exported = when (
            val result = remoteSource.export(
                ExportComponentsCommand(
                    apiUrl = ProjectApiUrl(apiUrl.value),
                    apiKey = apiKey,
                    projectId = context.projectId,
                    designSystemId = context.designSystemId,
                ),
            )
        ) {
            is ExportComponentsResult.Failed -> return FetchComponentsResult.Failed(result.message)
            is ExportComponentsResult.Exported -> result.value
        }

        val source = FetchSource(
            apiUrl = apiUrl,
            projectId = context.projectId.value,
            designSystemId = context.designSystemId.value,
            packageName = exported.name,
            packageVersion = exported.version,
            configurationCount = exported.configurations.size,
        )

        return writePackage(exported, source, command, context)
    }

    /**
     * Преобразует пакет и записывает его в рабочую копию.
     *
     * Отделено от барьеров разрешения не ради длины: до этого места ни один файл не тронут,
     * а после — трогается рабочая копия разработчика.
     */
    @Suppress("ReturnCount")
    private fun writePackage(
        exported: ExportedComponentPackage,
        source: FetchSource,
        command: FetchComponentsCommand,
        context: ProjectContext,
    ): FetchComponentsResult {
        val rendered = when (val conversion = render(exported)) {
            is RenderResult.Rejected -> return FetchComponentsResult.Failed(conversion.message, source)
            is RenderResult.Rendered -> conversion.configurations
        }

        val existing = when (val read = directoryReader.read(command.destination, context)) {
            is ComponentDirectoryReadResult.Failed -> return FetchComponentsResult.Failed(read.message, source)
            is ComponentDirectoryReadResult.Read -> read
        }

        val plan = when (
            val built = planBuilder.build(
                name = exported.name,
                version = exported.version,
                configurations = rendered,
                existing = existing.value,
            )
        ) {
            is ComponentPackageWritePlanResult.Failed -> return FetchComponentsResult.Failed(built.message, source)
            is ComponentPackageWritePlanResult.Built -> built.value
        }

        return when (val written = writer.write(plan, command.destination, context)) {
            is ComponentPackageWriteResult.Failed -> FetchComponentsResult.Failed(written.message, source)
            is ComponentPackageWriteResult.Written -> FetchComponentsResult.Fetched(
                source = source,
                path = written.path,
                fileNames = plan.configFiles.map { it.fileName },
                unrelatedFiles = plan.unrelatedFiles,
                underivedTypes = exported.underivedTypes,
            )
        }
    }

    /**
     * Преобразует весь пакет и отказывает на первой же неудаче.
     *
     * Частично записанный пакет хуже отказа: `meta.json` перестал бы описывать состав
     * директории. Диагностика называет компонент и стиль.
     */
    private fun render(exported: ExportedComponentPackage): RenderResult {
        val rendered = mutableListOf<RenderedComponentConfig>()
        exported.configurations.forEach { configuration ->
            when (val result = codec.encode(configuration.config)) {
                is ConfigCodecResult.Failure -> return RenderResult.Rejected(
                    "Error: cannot convert '${configuration.componentName}' " +
                        "(style '${configuration.styleName}'): ${result.reason.message}",
                )
                is ConfigCodecResult.Success -> rendered += RenderedComponentConfig(
                    componentName = configuration.componentName,
                    styleName = configuration.styleName,
                    config = result.value,
                )
            }
        }
        return RenderResult.Rendered(rendered)
    }
}

/**
 * Результат преобразования пакета в native-формат.
 */
private sealed interface RenderResult {
    data class Rendered(val configurations: List<RenderedComponentConfig>) : RenderResult

    data class Rejected(val message: String) : RenderResult
}

/**
 * Запрос на выполнение fetch.
 *
 * @property destination куда писать пакет.
 * @property apiKeyOverride API key, переданный аргументом.
 * @property apiUrlOverride backend API URL, переданный аргументом.
 */
public data class FetchComponentsCommand(
    public val destination: ComponentDestination,
    public val apiKeyOverride: String? = null,
    public val apiUrlOverride: String? = null,
)

/**
 * Источник пакета и его состав, печатаемые перед записью.
 *
 * @property apiUrl разрешённый backend API URL вместе с источником.
 * @property projectId идентификатор проекта.
 * @property designSystemId идентификатор дизайн-системы.
 * @property packageName имя дизайн-системы.
 * @property packageVersion версия последней опубликованной записи.
 * @property configurationCount число выгруженных конфигураций.
 */
public data class FetchSource(
    public val apiUrl: ResolvedApiUrl,
    public val projectId: String,
    public val designSystemId: String,
    public val packageName: String,
    public val packageVersion: String,
    public val configurationCount: Int,
)

/**
 * Результат выполнения fetch.
 */
public sealed interface FetchComponentsResult {
    /**
     * Источник пакета, если он был разрешён до отказа.
     */
    public val source: FetchSource?

    /**
     * Пакет записан в рабочую копию.
     *
     * @property source источник пакета и его состав.
     * @property path директория, в которую записан пакет.
     * @property fileNames имена записанных файлов конфигураций.
     * @property unrelatedFiles файлы, оставшиеся в директории от прежнего состава.
     * @property underivedTypes значения, вид заливки которых модель не смогла вывести.
     */
    public data class Fetched(
        override val source: FetchSource,
        public val path: String,
        public val fileNames: List<String>,
        public val unrelatedFiles: List<String>,
        public val underivedTypes: List<String>,
    ) : FetchComponentsResult

    /**
     * Fetch не выполнен.
     *
     * @property message deterministic сообщение для CLI output.
     * @property source источник пакета, если он был разрешён.
     */
    public data class Failed(
        public val message: String,
        override val source: FetchSource? = null,
    ) : FetchComponentsResult
}
