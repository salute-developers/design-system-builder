package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.core.application.ProjectApiKeyResult
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiKey
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.API_URL_ENV
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.components.application.ComponentConfigRemoteSource
import com.dsbuilder.frontend.feature.components.application.ComponentPackageLoader
import com.dsbuilder.frontend.feature.components.application.ComponentSource
import com.dsbuilder.frontend.feature.components.application.ExportComponentsCommand
import com.dsbuilder.frontend.feature.components.application.ExportComponentsResult
import com.dsbuilder.frontend.feature.components.application.ImportComponentsCommand
import com.dsbuilder.frontend.feature.components.application.ImportComponentsResult
import com.dsbuilder.frontend.feature.components.application.PushComponentsCommand
import com.dsbuilder.frontend.feature.components.application.PushComponentsResult
import com.dsbuilder.frontend.feature.components.application.PushComponentsUseCase
import com.dsbuilder.frontend.feature.components.domain.ComponentConfiguration
import com.dsbuilder.frontend.feature.components.domain.ComponentImportRejection
import com.dsbuilder.frontend.feature.components.domain.ComponentImportReport
import com.dsbuilder.frontend.feature.components.domain.ComponentPackage
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageResult
import com.dsbuilder.frontend.feature.components.domain.codec.ConfigCodec
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PushComponentsUseCaseTest {
    private val context = ProjectContext(
        projectId = ProjectId("project-a"),
        designSystemId = DesignSystemId("ds-a"),
        credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
        configPath = "/work/.sdds/config.json",
    )

    @Test
    fun sendsWholePackageThroughRemoteSourceOnce() {
        val commands = mutableListOf<ImportComponentsCommand>()
        val result = execute(onImport = { command -> commands += command })

        assertTrue(result is PushComponentsResult.Pushed, "push отказал: $result")
        assertEquals(1, commands.size, "выполнены лишние вызовы remote source: ${commands.size}")

        val sent = commands.single()
        assertEquals("http://localhost:8080", sent.apiUrl.value)
        assertEquals("secret-key", sent.apiKey.value)
        assertEquals("project-a", sent.projectId.value)
        assertEquals("ds-a", sent.designSystemId.value)
        assertEquals("sdds_sbcom", sent.packageName)
        assertEquals("/work/.sdds/components", sent.packageOrigin)
        assertEquals(2, sent.components.size)
    }

    @Test
    fun sendsConvertedConfigurationsNotNativeOnes() {
        val commands = mutableListOf<ImportComponentsCommand>()
        execute(onImport = { command -> commands += command })

        val sent = commands.single().components
        assertEquals(listOf("badge", "badge"), sent.map { it.componentName })
        assertEquals(listOf("badge-clear", "badge-solid"), sent.map { it.styleName })
        assertTrue(
            sent[1].config.variations.isNotEmpty(),
            "конфигурация не преобразована в common-формат: ${sent[1].config}",
        )
    }

    @Test
    fun dryRunIsPassedToRemoteSource() {
        val commands = mutableListOf<ImportComponentsCommand>()
        val result = execute(dryRun = true, onImport = { command -> commands += command })

        assertTrue(commands.single().dryRun, "dry run не передан в remote source")
        assertTrue((result as PushComponentsResult.Pushed).dryRun)
    }

    @Test
    fun applyIsPassedToRemoteSource() {
        val commands = mutableListOf<ImportComponentsCommand>()
        val result = execute(dryRun = false, onImport = { command -> commands += command })

        assertTrue(!commands.single().dryRun, "режим записи передан как dry run")
        assertTrue(!(result as PushComponentsResult.Pushed).dryRun)
    }

    @Test
    fun reportsTargetAndPackageTogether() {
        val result = execute()

        val target = assertNotNull(result.target, "цель не сообщена")
        assertEquals("http://localhost:8080", target.apiUrl.value)
        assertEquals("--api-url", target.apiUrl.sourceName)
        assertEquals("project-a", target.projectId)
        assertEquals("ds-a", target.designSystemId)
        assertEquals("sdds_sbcom", target.packageName)
        assertEquals("/work/.sdds/components", target.packageOrigin)
        assertEquals(2, target.configurationCount)
    }

    @Test
    fun returnsReportFromRemoteSource() {
        val result = execute()

        val pushed = assertNotNull(result as? PushComponentsResult.Pushed)
        assertEquals(1, pushed.report.created)
        assertEquals(2, pushed.report.updated)
        assertEquals(3, pushed.report.unchanged)
        assertEquals(1, pushed.report.rejected.size)
        assertEquals("badge", pushed.report.rejected.single().componentName)
        assertEquals("unknown property type", pushed.report.rejected.single().reason)
    }

    @Test
    fun rejectsDefaultApiUrlWithoutCallingRemoteSource() {
        var requested = false
        val result = execute(
            apiUrlOverride = null,
            environment = { null },
            onImport = { requested = true },
        )

        val failed = assertNotNull(result as? PushComponentsResult.Failed)
        assertTrue(failed.message.contains("--api-url"), failed.message)
        assertTrue(failed.message.contains(API_URL_ENV), failed.message)
        assertTrue(!requested, "запрос отправлен несмотря на умолчание API URL")
        assertNull(failed.target, "цель сообщена, хотя запрос не готовился")
    }

    @Test
    fun acceptsApiUrlFromEnvironment() {
        val result = execute(
            apiUrlOverride = null,
            environment = { name -> "http://env-host".takeIf { name == API_URL_ENV } },
        )

        assertEquals("http://env-host", assertNotNull(result.target).apiUrl.value)
    }

    @Test
    fun missingProjectContextIsReportedWithoutCallingRemoteSource() {
        var requested = false
        val result = execute(
            contextReader = ProjectContextReader {
                ProjectContextReadResult.Failed("Error: no .sdds/config.json found.")
            },
            onImport = { requested = true },
        )

        assertEquals("Error: no .sdds/config.json found.", (result as PushComponentsResult.Failed).message)
        assertTrue(!requested, "запрос отправлен без project context")
        assertNull(result.target, "цель сообщена без project context")
    }

    @Test
    fun missingApiKeyIsReportedWithoutCallingRemoteSource() {
        var requested = false
        val result = execute(
            apiKeyProvider = ProjectApiKeyProvider { _, _ ->
                ProjectApiKeyResult.Missing("Error: API key is not set.")
            },
            onImport = { requested = true },
        )

        assertEquals("Error: API key is not set.", (result as PushComponentsResult.Failed).message)
        assertTrue(!requested, "запрос отправлен без API key")
        assertNull(result.target, "цель сообщена без credentials")
    }

    @Test
    fun conversionFailureCancelsWholePushAndNamesTheFile() {
        var requested = false
        val result = execute(
            configurations = listOf(
                configuration(
                    "badge",
                    "badge-clear",
                    "badge_clear_config.json",
                    NativeConfigCorpus.plasmaStardsDivider,
                ),
                configuration("card", "card", "card_config.json", NativeConfigCorpus.plasmaHomedsCard),
            ),
            onImport = { requested = true },
        )

        val failed = assertNotNull(result as? PushComponentsResult.Failed)
        assertTrue(failed.message.contains("card"), failed.message)
        assertTrue(failed.message.contains("card_config.json"), failed.message)
        assertTrue(!requested, "частичный импорт отправлен")
        assertNotNull(failed.target, "цель не показана перед отказом преобразования")
    }

    @Test
    fun packageFailureIsReported() {
        val result = execute(
            loader = ComponentPackageLoader { _, _ -> ComponentPackageResult.Failed("Error: no meta.json.") },
        )

        assertEquals("Error: no meta.json.", (result as PushComponentsResult.Failed).message)
    }

    @Test
    fun remoteFailureIsReportedWithTarget() {
        val result = execute(
            importResult = ImportComponentsResult.Failed(
                "Status: forbidden. API key has no access to this project.",
            ),
        )

        val failed = assertNotNull(result as? PushComponentsResult.Failed)
        assertTrue(failed.message.contains("forbidden"), failed.message)
        assertNotNull(failed.target, "цель не показана при отказе backend")
    }

    @Test
    fun doesNotFailOnPackageNameMismatch() {
        val result = execute(packageName = "completely-different-name")

        assertTrue(result is PushComponentsResult.Pushed, "push отклонён из-за расхождения имён: $result")
    }

    @Suppress("LongParameterList")
    private fun execute(
        packageName: String = "sdds_sbcom",
        configurations: List<ComponentConfiguration> = defaultConfigurations,
        loader: ComponentPackageLoader? = null,
        contextReader: ProjectContextReader = ProjectContextReader { ProjectContextReadResult.Found(context) },
        apiKeyProvider: ProjectApiKeyProvider = ProjectApiKeyProvider { _, _ ->
            ProjectApiKeyResult.Found(ProjectApiKey("secret-key"))
        },
        dryRun: Boolean = true,
        apiUrlOverride: String? = "http://localhost:8080",
        environment: (String) -> String? = { null },
        importResult: ImportComponentsResult = ImportComponentsResult.Imported(REPORT),
        onImport: (ImportComponentsCommand) -> Unit = {},
    ): PushComponentsResult {
        val useCase = PushComponentsUseCase(
            projectContextReader = contextReader,
            projectApiKeyProvider = apiKeyProvider,
            apiUrlResolver = ApiUrlResolver(EnvironmentReader(environment)),
            componentPackageLoader = loader ?: ComponentPackageLoader { _, _ ->
                ComponentPackageResult.Loaded(
                    ComponentPackage(
                        name = packageName,
                        origin = "/work/.sdds/components",
                        configurations = configurations,
                    ),
                )
            },
            remoteSource = FakeComponentConfigRemoteSource(onImport, importResult),
            codec = ConfigCodec(),
        )

        return useCase.execute(
            PushComponentsCommand(
                source = ComponentSource(),
                dryRun = dryRun,
                apiUrlOverride = apiUrlOverride,
            ),
        )
    }

    private val defaultConfigurations = listOf(
        configuration(
            "badge",
            "badge-clear",
            "badge_clear_config.json",
            NativeConfigCorpus.plasmaStardsDivider,
        ),
        configuration(
            "badge",
            "badge-solid",
            "badge_solid_config.json",
            NativeConfigCorpus.plasmaB2cAvatarGroup,
        ),
    )

    private companion object {
        val REPORT = ComponentImportReport(
            created = 1,
            updated = 2,
            unchanged = 3,
            rejected = listOf(
                ComponentImportRejection(
                    componentName = "badge",
                    styleName = "badge-clear",
                    reason = "unknown property type",
                ),
            ),
        )

        fun configuration(
            componentName: String,
            styleName: String,
            fileName: String,
            nativeConfig: String,
        ) = ComponentConfiguration(
            componentName = componentName,
            styleName = styleName,
            fileName = fileName,
            nativeConfig = nativeConfig,
        )
    }
}

/**
 * Fake порта обмена конфигурациями.
 *
 * Порт перестал быть `fun interface`, когда к `import` добавился `export`, поэтому fake стал
 * классом. Push выгрузку не вызывает: обращение к ней здесь означало бы ошибку в барьерах.
 */
private class FakeComponentConfigRemoteSource(
    private val onImport: (ImportComponentsCommand) -> Unit,
    private val importResult: ImportComponentsResult,
) : ComponentConfigRemoteSource {
    override fun import(command: ImportComponentsCommand): ImportComponentsResult {
        onImport(command)
        return importResult
    }

    override fun export(command: ExportComponentsCommand): ExportComponentsResult =
        error("push не выгружает пакет")
}
