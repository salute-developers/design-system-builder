package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.network.API_URL_ENV
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.platform.PlatformRunPlan
import com.dsbuilder.frontend.feature.components.application.ApiMetaRemoteSource
import com.dsbuilder.frontend.feature.components.application.ApiMetaSource
import com.dsbuilder.frontend.feature.components.application.ApiMetaSourceResult
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaCommand
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaRemoteCommand
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaRemoteResult
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaResult
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaUseCase
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaImportReport
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaRejection
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaSkipped
import com.dsbuilder.frontend.feature.components.domain.apimeta.ComposeApiMetaNormalizer
import com.dsbuilder.frontend.feature.components.domain.apimeta.ViewApiMetaNormalizer
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ImportApiMetaUseCaseTest {
    private val context = ProjectContext(
        projectId = ProjectId("project-a"),
        designSystemId = DesignSystemId("ds-a"),
        credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
        configPath = "/work/.sdds/config.json",
        platforms = listOf(TargetPlatform.COMPOSE),
    )

    @Test
    fun sendsTheNormalizedManifestThroughTheRemoteSourceOnce() = runTest {
        val sent = mutableListOf<ImportApiMetaRemoteCommand>()

        val result = execute(onImport = { sent += it })

        assertIs<ImportApiMetaResult.Imported>(result, "импорт отказал: $result")
        val command = sent.single()
        assertEquals("http://localhost:8080", command.apiUrl.value)
        assertEquals(BackendCredential.ProjectKey("secret-key"), command.credential)
        assertEquals("project-a", command.projectId.value)
        assertEquals("ds-a", command.designSystemId.value)
        assertEquals("compose", command.platform)
        assertEquals("/work/build/theme-builder/components/uikit-compose-api-meta.json", command.source)
        assertEquals(listOf("Avatar", "DropZone", "Slider"), command.manifest.components.map { it.name })
        assertEquals(66, command.manifest.propertyCount)
    }

    @Test
    fun dryRunAndApplyAreForwarded() = runTest {
        val sent = mutableListOf<ImportApiMetaRemoteCommand>()

        val dry = execute(dryRun = true, onImport = { sent += it })
        val applied = execute(dryRun = false, onImport = { sent += it })

        assertEquals(listOf(true, false), sent.map { it.dryRun })
        assertTrue((dry as ImportApiMetaResult.Imported).dryRun)
        assertTrue(!(applied as ImportApiMetaResult.Imported).dryRun)
    }

    @Test
    fun typeMapIsAppliedBeforeSending() = runTest {
        val sent = mutableListOf<ImportApiMetaRemoteCommand>()

        execute(typeMap = mapOf("dimension" to "float"), onImport = { sent += it })

        val types = sent.single().manifest.components.flatMap { it.properties }.map { it.type }.toSet()
        assertTrue("dimension" !in types, "тип не подменён: $types")
    }

    @Test
    fun returnsTheReportAndTheTargetTogether() = runTest {
        val result = execute()

        val imported = assertIs<ImportApiMetaResult.Imported>(result)
        assertEquals(REPORT, imported.report)
        assertEquals("http://localhost:8080", imported.target.apiUrl.value)
        assertEquals("--api-url", imported.target.apiUrl.sourceName)
        assertEquals("project-a", imported.target.projectId)
        assertEquals("ds-a", imported.target.designSystemId)
        assertEquals(TargetPlatform.COMPOSE, imported.target.platform)
        assertEquals(3, imported.target.componentCount)
        assertEquals(66, imported.target.propertyCount)
        assertEquals(6, imported.target.stateCount)
    }

    @Test
    fun theTargetIsAnnouncedBeforeTheRequestIsSent() = runTest {
        val events = mutableListOf<String>()

        execute(onTarget = { events += "target" }, onImport = { events += "request" })

        assertEquals(listOf("target", "request"), events)
    }

    @Test
    fun anUnsupportedPlatformFailsBeforeAnyToolIsStarted() = runTest {
        var read = false
        var requested = false

        val result = execute(
            platform = TargetPlatform.SWIFT_UI,
            onRead = { read = true },
            onImport = { requested = true },
        )

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.contains("swiftui"), failed.message)
        assertTrue(failed.message.contains("compose"), failed.message)
        assertTrue(failed.message.contains("android-view"), failed.message)
        assertTrue(!read, "платформенный инструмент запущен для неподдержанной платформы")
        assertTrue(!requested, "запрос отправлен для неподдержанной платформы")
    }

    @Test
    fun anAndroidViewProjectGetsTheViewNormalizerAndTheXmlPlatform() = runTest {
        val sent = mutableListOf<ImportApiMetaRemoteCommand>()

        val result = execute(
            platform = null,
            contextPlatforms = listOf(TargetPlatform.ANDROID_VIEW),
            meta = ApiMetaSourceResult.Read(VIEW_META_PATH, VIEW_API_META_CORPUS),
            onImport = { sent += it },
        )

        assertIs<ImportApiMetaResult.Imported>(result, "импорт View отказал: $result")
        val command = sent.single()
        assertEquals("xml", command.platform)
        assertEquals(VIEW_META_PATH, command.source)
        val spinner = command.manifest.components.single { it.name == "Spinner" }
        assertEquals(
            listOf("android:maxHeight", "android:maxWidth", "android:minHeight", "android:minWidth"),
            spinner.properties.single { it.name == "size" }.platformNames,
        )
        assertEquals(200, command.manifest.propertyCount)
    }

    @Test
    fun skippedEntriesOfTheViewMetaReachTheResult() = runTest {
        val result = execute(
            platform = TargetPlatform.ANDROID_VIEW,
            meta = ApiMetaSourceResult.Read(VIEW_META_PATH, VIEW_API_META_CORPUS),
        )

        val skipped = assertIs<ImportApiMetaResult.Imported>(result).skipped
        assertEquals(
            listOf(
                ApiMetaSkipped("properties of type unknown", 20),
                ApiMetaSkipped("properties of sub-style records", 18),
            ),
            skipped,
        )
    }

    @Test
    fun composeMetaHasNoSkippedEntries() = runTest {
        assertEquals(emptyList(), assertIs<ImportApiMetaResult.Imported>(execute()).skipped)
    }

    @Test
    fun aComposeMetaGivenToAnAndroidViewProjectIsRejectedAndNothingIsSent() = runTest {
        var requested = false

        val result = execute(
            platform = TargetPlatform.ANDROID_VIEW,
            meta = readMeta(COMPOSE_API_META_CORPUS),
            onImport = { requested = true },
        )

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.contains(META_PATH), failed.message)
        assertTrue(!requested)
    }

    @Test
    fun anEmptyViewMetaNamesTheFileAndTheClasspathAndSendsNothing() = runTest {
        var requested = false

        val result = execute(
            platform = TargetPlatform.ANDROID_VIEW,
            meta = ApiMetaSourceResult.Read(VIEW_META_PATH, "{}"),
            onImport = { requested = true },
        )

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.contains(VIEW_META_PATH), failed.message)
        assertTrue(failed.message.contains("classpath"), failed.message)
        assertTrue(!requested)
    }

    @Test
    fun platformComesFromTheProjectConfigWhenNotGiven() = runTest {
        val sent = mutableListOf<ImportApiMetaRemoteCommand>()

        execute(platform = null, onImport = { sent += it })

        assertEquals("compose", sent.single().platform)
    }

    @Test
    fun aMissingPlatformIsReportedWithoutRunningTheTool() = runTest {
        var read = false

        val result = execute(
            platform = null,
            contextPlatforms = emptyList(),
            onRead = { read = true },
        )

        assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(!read)
    }

    @Test
    fun rejectsTheDefaultApiUrlBeforeRunningTheTool() = runTest {
        var read = false
        var requested = false

        val result = execute(
            apiUrlOverride = null,
            environment = { null },
            onRead = { read = true },
            onImport = { requested = true },
        )

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.contains("--api-url"), failed.message)
        assertTrue(failed.message.contains(API_URL_ENV), failed.message)
        assertTrue(!read, "Gradle запущен несмотря на умолчание API URL")
        assertTrue(!requested)
        assertNull(failed.target)
    }

    @Test
    fun acceptsApiUrlFromEnvironment() = runTest {
        val result = execute(
            apiUrlOverride = null,
            environment = { name -> "http://env-host".takeIf { name == API_URL_ENV } },
        )

        assertEquals("http://env-host", assertNotNull(result.target).apiUrl.value)
    }

    @Test
    fun missingProjectContextIsReportedWithoutRunningTheTool() = runTest {
        var read = false

        val result = execute(
            contextReader = ProjectContextReader { _ ->
                ProjectContextReadResult.Failed("Error: no .sdds/config.json found.")
            },
            onRead = { read = true },
        )

        assertEquals("Error: no .sdds/config.json found.", (result as ImportApiMetaResult.Failed).message)
        assertTrue(!read)
    }

    @Test
    fun missingApiKeyIsReportedWithoutRunningTheTool() = runTest {
        var read = false

        val result = execute(
            credentialProvider = testCredentialProvider(
                CredentialResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Error: API key is not set."),
            ),
            onRead = { read = true },
        )

        assertEquals("Error: API key is not set.", (result as ImportApiMetaResult.Failed).message)
        assertTrue(!read, "Gradle запущен без API key")
    }

    @Test
    fun aToolFailureIsReportedAndNothingIsSent() = runTest {
        var requested = false

        val result = execute(
            meta = ApiMetaSourceResult.Failed("Toolchain 'android' failed with exit code 1: see the output above"),
            onImport = { requested = true },
        )

        assertEquals(
            "Toolchain 'android' failed with exit code 1: see the output above",
            (result as ImportApiMetaResult.Failed).message,
        )
        assertTrue(!requested)
    }

    @Test
    fun anEmptyMetaNamesTheFileAndTheClasspathAndSendsNothing() = runTest {
        var requested = false

        val result = execute(meta = readMeta("[]"), onImport = { requested = true })

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.contains(META_PATH), failed.message)
        assertTrue(failed.message.contains("classpath"), failed.message)
        assertTrue(!requested, "пустой манифест отправлен в backend")
    }

    @Test
    fun anUnreadableMetaIsReportedWithTheFile() = runTest {
        var requested = false

        val result = execute(meta = readMeta("not json"), onImport = { requested = true })

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.contains(META_PATH), failed.message)
        assertTrue(!requested)
    }

    @Test
    fun aBackendFailureKeepsTheTarget() = runTest {
        val result = execute(importResult = ImportApiMetaRemoteResult.Failed("Status: forbidden."))

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertEquals("Status: forbidden.", failed.message)
        assertNotNull(failed.target)
    }

    @Test
    fun conflictsInsideTheMetaAreCarriedToTheResult() = runTest {
        val meta = readMeta(
            """[{"componentName":"Box","params":[
                {"id":"size","type":"dimension"},{"id":"size","type":"float"}]}]""",
        )

        val result = execute(meta = meta)

        assertEquals(
            listOf("Box.size: kept dimension, ignored float"),
            assertIs<ImportApiMetaResult.Imported>(result).conflicts,
        )
    }

    private fun readMeta(text: String) = ApiMetaSourceResult.Read(META_PATH, text)

    @Suppress("LongParameterList")
    private suspend fun execute(
        platform: TargetPlatform? = TargetPlatform.COMPOSE,
        contextPlatforms: List<TargetPlatform> = listOf(TargetPlatform.COMPOSE),
        dryRun: Boolean = true,
        typeMap: Map<String, String> = emptyMap(),
        apiUrlOverride: String? = "http://localhost:8080",
        environment: (String) -> String? = { null },
        meta: ApiMetaSourceResult = readMeta(COMPOSE_API_META_CORPUS),
        importResult: ImportApiMetaRemoteResult = ImportApiMetaRemoteResult.Imported(REPORT),
        contextReader: ProjectContextReader = ProjectContextReader { _ ->
            ProjectContextReadResult.Found(context.copy(platforms = contextPlatforms))
        },
        credentialProvider: CredentialProvider = testCredentialProvider(
            CredentialResult.Selected(BackendCredential.ProjectKey("secret-key"), BackendCredentialType.PROJECT_KEY),
        ),
        onRead: () -> Unit = {},
        onTarget: () -> Unit = {},
        onImport: (ImportApiMetaRemoteCommand) -> Unit = {},
    ): ImportApiMetaResult {
        val useCase = ImportApiMetaUseCase(
            projectContextReader = contextReader,
            credentialProvider = credentialProvider,
            apiUrlResolver = ApiUrlResolver(EnvironmentReader(environment)),
            metaSource = object : ApiMetaSource {
                override fun read(
                    platform: TargetPlatform,
                    toolOverride: String?,
                    onPlan: (PlatformRunPlan) -> Unit,
                ): ApiMetaSourceResult {
                    onRead()
                    return meta
                }
            },
            remoteSource = object : ApiMetaRemoteSource {
                override suspend fun import(command: ImportApiMetaRemoteCommand): ImportApiMetaRemoteResult {
                    onImport(command)
                    return importResult
                }
            },
            normalizers = mapOf(
                TargetPlatform.COMPOSE to ComposeApiMetaNormalizer(),
                TargetPlatform.ANDROID_VIEW to ViewApiMetaNormalizer(),
            ),
        )

        return useCase.execute(
            ImportApiMetaCommand(
                platform = platform,
                dryRun = dryRun,
                typeMap = typeMap,
                apiUrlOverride = apiUrlOverride,
            ),
            onTarget = { onTarget() },
        )
    }

    private companion object {
        const val META_PATH = "/work/build/theme-builder/components/uikit-compose-api-meta.json"
        const val VIEW_META_PATH = "/work/build/theme-builder/components/uikit-api-meta.json"

        val REPORT = ApiMetaImportReport(
            createdComponents = 1,
            createdProperties = 2,
            createdStates = 3,
            createdAliases = 4,
            createdLinks = 5,
            unchangedProperties = 6,
            rejected = listOf(ApiMetaRejection("Box", "odd", "unknown property type: odd")),
            typeMismatches = listOf("Box.size: db=float, meta=dimension"),
        )
    }
}
