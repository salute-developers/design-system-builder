package com.dsbuilder.frontend.cli.feature.components

import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyResult
import com.dsbuilder.frontend.cli.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.cli.core.application.ProjectContextReader
import com.dsbuilder.frontend.cli.core.credentials.EnvironmentReader
import com.dsbuilder.frontend.cli.core.domain.CredentialEnvName
import com.dsbuilder.frontend.cli.core.domain.DesignSystemId
import com.dsbuilder.frontend.cli.core.domain.ProjectApiKey
import com.dsbuilder.frontend.cli.core.domain.ProjectContext
import com.dsbuilder.frontend.cli.core.domain.ProjectId
import com.dsbuilder.frontend.cli.core.http.ApiUrlResolver
import com.dsbuilder.frontend.cli.feature.components.application.ComponentDestination
import com.dsbuilder.frontend.cli.feature.components.application.ComponentDirectoryReadResult
import com.dsbuilder.frontend.cli.feature.components.application.ComponentPackageDirectoryReader
import com.dsbuilder.frontend.cli.feature.components.application.ComponentPackageWriteResult
import com.dsbuilder.frontend.cli.feature.components.application.ExportComponentsCommand
import com.dsbuilder.frontend.cli.feature.components.application.ExportComponentsResult
import com.dsbuilder.frontend.cli.feature.components.application.FetchComponentsCommand
import com.dsbuilder.frontend.cli.feature.components.application.FetchComponentsResult
import com.dsbuilder.frontend.cli.feature.components.application.FetchComponentsUseCase
import com.dsbuilder.frontend.cli.feature.components.application.ImportComponentsCommand
import com.dsbuilder.frontend.cli.feature.components.application.ImportComponentsResult
import com.dsbuilder.frontend.cli.feature.components.application.LocalComponentPackageWriter
import com.dsbuilder.frontend.cli.feature.components.domain.ComponentPackageMetaEntry
import com.dsbuilder.frontend.cli.feature.components.domain.ComponentPackageWritePlan
import com.dsbuilder.frontend.cli.feature.components.domain.ExistingComponentPackage
import com.dsbuilder.frontend.cli.feature.components.domain.ExportedComponentConfig
import com.dsbuilder.frontend.cli.feature.components.domain.ExportedComponentPackage
import com.dsbuilder.frontend.cli.feature.components.domain.codec.CommonConfig
import com.dsbuilder.frontend.cli.feature.components.domain.codec.CommonTarget
import com.dsbuilder.frontend.cli.feature.components.domain.codec.CommonTargetProperty
import com.dsbuilder.frontend.cli.feature.components.domain.codec.CommonVariation
import com.dsbuilder.frontend.cli.feature.components.domain.codec.CommonVariationValue
import com.dsbuilder.frontend.cli.feature.components.domain.codec.ConfigCodec
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Тесты use case выгрузки.
 *
 * Проверяется оркестрация и порядок барьеров, а не форма JSON и не содержимое файлов: первое
 * живёт в реализации порта, второе — в построителе плана.
 */
class FetchComponentsUseCaseTest {

    private val context = ProjectContext(
        projectId = ProjectId("project-a"),
        designSystemId = DesignSystemId("ds-a"),
        credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
        configPath = "/work/.sdds/config.json",
    )

    @Test
    fun requestsPackageOnceAndWritesIt() {
        val commands = mutableListOf<ExportComponentsCommand>()
        val result = execute(onExport = { commands += it })

        assertTrue(result is FetchComponentsResult.Fetched, "fetch отклонён: $result")
        // Весь пакет забирается одним запросом, дизайн-система адресуется идентификатором.
        assertEquals(1, commands.size)
        assertEquals("project-a", commands.single().projectId.value)
        assertEquals("ds-a", commands.single().designSystemId.value)
        assertEquals("secret-key", commands.single().apiKey.value)

        assertEquals("/work/.sdds/components", result.path)
        assertEquals(listOf("avatar_config.json"), result.fileNames)
        assertEquals("sdds_serv", result.source.packageName)
        assertEquals("0.6.0-rc", result.source.packageVersion)
        assertEquals(1, result.source.configurationCount)
    }

    @Test
    fun failsWholeFetchOnFirstConversionErrorBeforeTouchingFiles() {
        var directoryRead = false
        var written = false

        val result = execute(
            configurations = listOf(
                ExportedComponentConfig(
                    componentName = "badge",
                    styleName = "badge-clear",
                    // Пересечение ссылается на ось, которой в конфигурации нет.
                    config = CommonConfig(
                        variations = listOf(
                            CommonVariation(
                                id = "size",
                                name = "size",
                                values = listOf(
                                    CommonVariationValue(
                                        name = "m",
                                        targets = listOf(
                                            CommonTarget(
                                                properties = listOf(
                                                    CommonTargetProperty("view", JsonPrimitive("accent")),
                                                ),
                                            ),
                                        ),
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
            ),
            onDirectoryRead = { directoryRead = true },
            onWrite = { written = true },
        )

        val failure = result as? FetchComponentsResult.Failed ?: error("ожидался отказ: $result")
        assertTrue(failure.message.contains("badge"), failure.message)
        assertTrue(failure.message.contains("badge-clear"), failure.message)
        // Барьер стоит до файловой системы: неконвертируемая конфигурация не должна
        // приводить к чтению директории и тем более к записи.
        assertTrue(!directoryRead, "директория прочитана несмотря на отказ преобразования")
        assertTrue(!written, "запись выполнена несмотря на отказ преобразования")
        // Источник уже разрешён, поэтому печатается вместе с отказом.
        assertEquals("sdds_serv", failure.source?.packageName)
    }

    @Test
    fun failsWhenBackendRefuses() {
        var written = false
        val result = execute(
            exportResult = ExportComponentsResult.Failed("Error: backend refused."),
            onWrite = { written = true },
        )

        val failure = result as? FetchComponentsResult.Failed ?: error("ожидался отказ: $result")
        assertEquals("Error: backend refused.", failure.message)
        assertTrue(failure.source == null, "источник не разрешён, печатать нечего")
        assertTrue(!written)
    }

    @Test
    fun failsWhenPlanBuilderRejects() {
        var written = false
        val result = execute(
            configurations = listOf(exported("chip", "chip"), exported("chip", "chip-embedded")),
            existing = ExistingComponentPackage(
                entries = listOf(ComponentPackageMetaEntry("chip", "chip", "chip_embedded_config.json")),
            ),
            onWrite = { written = true },
        )

        val failure = result as? FetchComponentsResult.Failed ?: error("ожидался отказ: $result")
        assertTrue(failure.message.contains("chip_embedded_config.json"), failure.message)
        assertTrue(!written, "запись выполнена несмотря на отказ построителя плана")
    }

    @Test
    fun failsWhenCredentialsAreMissing() {
        var exported = false
        val result = execute(
            apiKeyProvider = ProjectApiKeyProvider { _, _ -> ProjectApiKeyResult.Missing("Error: no api key.") },
            onExport = { exported = true },
        )

        assertEquals("Error: no api key.", (result as FetchComponentsResult.Failed).message)
        // Барьер credentials стоит до запроса: без ключа обращаться к backend незачем.
        assertTrue(!exported)
    }

    @Test
    fun carriesUnderivedTypesIntoResult() {
        val result = execute(underivedTypes = listOf("avatar.default.background"))

        assertEquals(
            listOf("avatar.default.background"),
            (result as FetchComponentsResult.Fetched).underivedTypes,
        )
    }

    private fun exported(componentName: String, styleName: String) = ExportedComponentConfig(
        componentName = componentName,
        styleName = styleName,
        config = CommonConfig(),
    )

    @Suppress("LongParameterList")
    private fun execute(
        configurations: List<ExportedComponentConfig> = listOf(exported("avatar", "avatar")),
        underivedTypes: List<String> = emptyList(),
        existing: ExistingComponentPackage = ExistingComponentPackage(),
        exportResult: ExportComponentsResult? = null,
        apiKeyProvider: ProjectApiKeyProvider = ProjectApiKeyProvider { _, _ ->
            ProjectApiKeyResult.Found(ProjectApiKey("secret-key"))
        },
        onExport: (ExportComponentsCommand) -> Unit = {},
        onDirectoryRead: () -> Unit = {},
        onWrite: () -> Unit = {},
    ): FetchComponentsResult {
        val result = exportResult ?: ExportComponentsResult.Exported(
            ExportedComponentPackage(
                name = "sdds_serv",
                version = "0.6.0-rc",
                configurations = configurations,
                underivedTypes = underivedTypes,
            ),
        )

        val useCase = FetchComponentsUseCase(
            projectContextReader = ProjectContextReader { ProjectContextReadResult.Found(context) },
            projectApiKeyProvider = apiKeyProvider,
            apiUrlResolver = ApiUrlResolver(EnvironmentReader { null }),
            remoteSource = FakeRemoteSource(onExport, result),
            directoryReader = ComponentPackageDirectoryReader { _, _ ->
                onDirectoryRead()
                ComponentDirectoryReadResult.Read(existing, "/work/.sdds/components")
            },
            writer = LocalComponentPackageWriter { _: ComponentPackageWritePlan, _, _ ->
                onWrite()
                ComponentPackageWriteResult.Written("/work/.sdds/components")
            },
            codec = ConfigCodec(),
        )

        return useCase.execute(
            FetchComponentsCommand(
                destination = ComponentDestination(),
                apiUrlOverride = "http://localhost:8080",
            ),
        )
    }
}

/**
 * Fake порта обмена конфигурациями: fetch пользуется только выгрузкой.
 */
private class FakeRemoteSource(
    private val onExport: (ExportComponentsCommand) -> Unit,
    private val result: ExportComponentsResult,
) : com.dsbuilder.frontend.cli.feature.components.application.ComponentConfigRemoteSource {
    override fun import(command: ImportComponentsCommand): ImportComponentsResult =
        error("fetch не загружает пакет")

    override fun export(command: ExportComponentsCommand): ExportComponentsResult {
        onExport(command)
        return result
    }
}
