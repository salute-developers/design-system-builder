package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.ResolvedApiUrl
import com.dsbuilder.frontend.core.platform.PlatformResolution
import com.dsbuilder.frontend.core.platform.PlatformResolver
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
    private val credentialProvider: CredentialProvider,
    private val apiUrlResolver: ApiUrlResolver,
    private val remoteSource: ComponentConfigRemoteSource,
    private val directoryReader: ComponentPackageDirectoryReader,
    private val writer: LocalComponentPackageWriter,
    private val codec: ConfigCodec,
    private val webAdapterSource: WebAdapterFileSource,
    private val webAdapterWriter: WebAdapterFileWriter,
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
    public suspend fun execute(command: FetchComponentsCommand): FetchComponentsResult {
        val found = when (
            val read = projectContextReader.requireContext(null, command.designSystemUri, command.projectKeyEnvName)
        ) {
            is ProjectContextReadResult.Failed -> return FetchComponentsResult.Failed(read.message)
            is ProjectContextReadResult.Found -> read
        }
        val context = found.context
        if (context.configPath.isBlank() && command.destination.directory == null) {
            return FetchComponentsResult.Failed("--to is required with --design-system.")
        }
        val apiUrl = apiUrlResolver.resolve(command.apiUrlOverride, found.projectEnvironment)

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
            is CredentialResult.Failed -> return FetchComponentsResult.Failed(selected.message)
            is CredentialResult.Selected -> selected.credential
        }

        val remoteCommand = ExportComponentsCommand(
            apiUrl = ProjectApiUrl(apiUrl.value),
            credential = credential,
            projectId = context.projectId,
            designSystemId = context.designSystemId,
        )
        val exported = when (val result = remoteSource.export(remoteCommand)) {
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

        // Загружается до записи: недоступная ручка не должна оставить пакет без адаптера.
        val webAdapter = loadWebAdapter(command, context, remoteCommand)
        if (webAdapter is WebAdapterFileResult.Failed) return FetchComponentsResult.Failed(webAdapter.message, source)
        val result = writePackage(exported, source, command, context)
        if (result !is FetchComponentsResult.Fetched) return result
        if (webAdapter !is WebAdapterFileResult.Loaded) return result
        return writeWebAdapter(result, context, command, webAdapter)
    }

    /**
     * Web-адаптер нужен только React; остальным платформам — `null`.
     *
     * Платформа выбирается тем же правилом, что у команд генерации: `--platform`, иначе единственная
     * платформа project config. Невыбранная платформа fetch не отклоняет — пакет общий для платформ,
     * и без React web-адаптер просто не загружается.
     */
    private suspend fun loadWebAdapter(
        command: FetchComponentsCommand,
        context: ProjectContext,
        remoteCommand: ExportComponentsCommand,
    ): WebAdapterFileResult? {
        val platform = (PlatformResolver.resolve(command.platform, context.platforms) as? PlatformResolution.Resolved)
            ?.platform
        return if (platform == TargetPlatform.REACT) webAdapterSource.fetch(remoteCommand) else null
    }

    /**
     * Записывает web-адаптер после пакета.
     *
     * Адаптер загружен до записи пакета, поэтому здесь отказать может только файловая система.
     */
    private fun writeWebAdapter(
        result: FetchComponentsResult.Fetched,
        context: ProjectContext,
        command: FetchComponentsCommand,
        webAdapter: WebAdapterFileResult.Loaded,
    ): FetchComponentsResult =
        when (val written = webAdapterWriter.write(context, command.destination, webAdapter)) {
            is ComponentPackageWriteResult.Failed -> FetchComponentsResult.Failed(written.message, result.source)
            is ComponentPackageWriteResult.Written -> result.copy(webAdapterPath = written.path)
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
 * @property designSystemUri явная ссылка на дизайн-систему.
 * @property projectKeyEnvName env-переменная ключа для явной ссылки.
 * @property platform платформа из `--platform`; без неё берётся единственная платформа project
 *   config. [TargetPlatform.REACT] дополнительно выгружает web-адаптер.
 */
public data class FetchComponentsCommand(
    public val destination: ComponentDestination,
    public val apiKeyOverride: String? = null,
    public val apiUrlOverride: String? = null,
    public val designSystemUri: String? = null,
    public val projectKeyEnvName: String? = null,
    public val platform: TargetPlatform? = null,
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
     * @property webAdapterPath путь web-адаптера, если он выгружался.
     * @property underivedTypes значения, вид заливки которых модель не смогла вывести.
     */
    public data class Fetched(
        override val source: FetchSource,
        public val path: String,
        public val fileNames: List<String>,
        public val unrelatedFiles: List<String>,
        public val underivedTypes: List<String>,
        public val webAdapterPath: String? = null,
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
