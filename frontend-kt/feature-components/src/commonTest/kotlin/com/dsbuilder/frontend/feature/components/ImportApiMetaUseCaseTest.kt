package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.network.API_URL_ENV
import com.dsbuilder.frontend.core.network.ApiUrlResolver
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
    @Test
    fun sendsTheNormalizedManifestThroughTheRemoteSourceOnce() = runTest {
        val sent = mutableListOf<ImportApiMetaRemoteCommand>()

        val result = execute(onImport = { sent += it })

        assertIs<ImportApiMetaResult.Imported>(result, "импорт отказал: $result")
        val command = sent.single()
        assertEquals("http://localhost:8080", command.apiUrl.value)
        assertEquals(BackendCredential.Bearer("admin-token"), command.credential)
        assertEquals("compose", command.platform)
        assertEquals(listOf("Avatar", "DropZone", "Slider"), command.manifest.components.map { it.name })
        assertEquals(66, command.manifest.propertyCount)
    }

    @Test
    fun theSourceSentToTheBackendIsTheFileNameWithoutDirectories() = runTest {
        val sent = mutableListOf<ImportApiMetaRemoteCommand>()

        execute(onImport = { sent += it })
        execute(
            meta = ApiMetaSourceResult.Read(
                "C:\\work\\meta\\uikit-compose-api-meta.json",
                COMPOSE_API_META_CORPUS,
            ),
            onImport = {
                sent += it
            },
        )

        assertEquals(listOf("uikit-compose-api-meta.json", "uikit-compose-api-meta.json"), sent.map { it.source })
    }

    @Test
    fun onlyTheUserSessionPolicyIsRequestedAndNoProjectKeyIsOffered() = runTest {
        val requests = mutableListOf<CredentialRequest>()

        execute(onCredential = { requests += it })

        val request = requests.single()
        assertEquals(CredentialPolicy.USER_SESSION, request.policy)
        assertNull(request.projectKeyOverride)
        assertEquals("http://localhost:8080", request.apiUrl.value)
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
        assertEquals(TargetPlatform.COMPOSE, imported.target.platform)
        assertEquals(META_PATH, imported.target.source)
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
    fun anAndroidViewMetaGetsTheViewNormalizerAndTheXmlPlatform() = runTest {
        val sent = mutableListOf<ImportApiMetaRemoteCommand>()

        val result = execute(
            platform = TargetPlatform.ANDROID_VIEW,
            meta = ApiMetaSourceResult.Read(VIEW_META_PATH, VIEW_API_META_CORPUS),
            onImport = { sent += it },
        )

        assertIs<ImportApiMetaResult.Imported>(result, "импорт View отказал: $result")
        val command = sent.single()
        assertEquals("xml", command.platform)
        assertEquals("uikit-api-meta.json", command.source)
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

        assertEquals(
            listOf(
                ApiMetaSkipped("properties of type unknown", 20),
                ApiMetaSkipped("properties of sub-style records", 18),
            ),
            assertIs<ImportApiMetaResult.Imported>(result).skipped,
        )
    }

    @Test
    fun composeMetaHasNoSkippedEntries() = runTest {
        assertEquals(emptyList(), assertIs<ImportApiMetaResult.Imported>(execute()).skipped)
    }

    @Test
    fun anUnsupportedPlatformFailsBeforeAnythingIsReadOrResolved() = runTest {
        val touched = Touched()

        val result = execute(platform = TargetPlatform.SWIFT_UI, touched = touched)

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.contains("swiftui"), failed.message)
        assertTrue(failed.message.contains("compose") && failed.message.contains("android-view"), failed.message)
        touched.assertNothing()
    }

    @Test
    fun rejectsTheDefaultApiUrlBeforeAnythingIsReadOrResolved() = runTest {
        val touched = Touched()

        val result = execute(apiUrlOverride = null, environment = { null }, touched = touched)

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.contains("--api-url"), failed.message)
        assertTrue(failed.message.contains(API_URL_ENV), failed.message)
        assertNull(failed.target)
        touched.assertNothing()
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
    fun aMissingFileFailsBeforeTheCredentialIsResolvedAndSendsNothing() = runTest {
        val touched = Touched()

        val result = execute(
            meta = ApiMetaSourceResult.Failed("Error: API meta file '/work/missing.json' does not exist."),
            touched = touched,
        )

        assertEquals(
            "Error: API meta file '/work/missing.json' does not exist.",
            assertIs<ImportApiMetaResult.Failed>(result).message,
        )
        assertTrue(!touched.credentialResolved, "credential запрошен до проверки файла")
        assertTrue(!touched.requested)
    }

    @Test
    fun anEmptyComposeMetaNamesTheFileAndSendsNothing() = runTest {
        val touched = Touched()

        val result = execute(meta = readMeta("[]"), touched = touched)

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.contains(META_PATH), failed.message)
        assertTrue(failed.message.contains("no components"), failed.message)
        assertTrue(!touched.credentialResolved && !touched.requested)
    }

    @Test
    fun anEmptyViewMetaNamesTheFileAndSendsNothing() = runTest {
        val touched = Touched()

        val result = execute(
            platform = TargetPlatform.ANDROID_VIEW,
            meta = ApiMetaSourceResult.Read(VIEW_META_PATH, "{}"),
            touched = touched,
        )

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.contains(VIEW_META_PATH), failed.message)
        assertTrue(!touched.requested)
    }

    @Test
    fun aMetaOfAnotherPlatformIsReportedWithTheFileAndSendsNothing() = runTest {
        val touched = Touched()

        val result = execute(
            platform = TargetPlatform.ANDROID_VIEW,
            meta = readMeta(COMPOSE_API_META_CORPUS),
            touched = touched,
        )

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.contains(META_PATH), failed.message)
        assertTrue(!touched.credentialResolved && !touched.requested)
    }

    @Test
    fun noUserSessionTellsHowToLogInForTheSameApiUrlAndSendsNothing() = runTest {
        val touched = Touched()

        val result = execute(
            credential = CredentialResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Error: authentication is required."),
            touched = touched,
        )

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertTrue(failed.message.startsWith("Error: authentication is required."), failed.message)
        assertTrue(failed.message.contains("dsbuilder auth login --api-url http://localhost:8080"), failed.message)
        assertTrue(failed.message.contains("system administrator"), failed.message)
        assertTrue(!touched.requested)
        assertNull(failed.target)
    }

    @Test
    fun otherCredentialFailuresKeepTheirMessage() = runTest {
        val result = execute(
            credential = CredentialResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, "Error: backend is unavailable."),
        )

        assertEquals("Error: backend is unavailable.", assertIs<ImportApiMetaResult.Failed>(result).message)
    }

    @Test
    fun aBackendFailureKeepsTheTarget() = runTest {
        val result = execute(importResult = ImportApiMetaRemoteResult.Failed("Status: forbidden. Server: no role"))

        val failed = assertIs<ImportApiMetaResult.Failed>(result)
        assertEquals("Status: forbidden. Server: no role", failed.message)
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

    /** Что команда успела затронуть: нужно, чтобы проверять порядок барьеров. */
    private class Touched {
        var read = false
        var credentialResolved = false
        var requested = false

        fun assertNothing() {
            assertTrue(!read, "файл прочитан")
            assertTrue(!credentialResolved, "credential запрошен")
            assertTrue(!requested, "запрос отправлен")
        }
    }

    @Suppress("LongParameterList")
    private suspend fun execute(
        platform: TargetPlatform = TargetPlatform.COMPOSE,
        dryRun: Boolean = true,
        typeMap: Map<String, String> = emptyMap(),
        apiUrlOverride: String? = "http://localhost:8080",
        environment: (String) -> String? = { null },
        meta: ApiMetaSourceResult = readMeta(COMPOSE_API_META_CORPUS),
        importResult: ImportApiMetaRemoteResult = ImportApiMetaRemoteResult.Imported(REPORT),
        credential: CredentialResult = CredentialResult.Selected(
            BackendCredential.Bearer("admin-token"),
            BackendCredentialType.USER_SESSION,
        ),
        touched: Touched = Touched(),
        onCredential: (CredentialRequest) -> Unit = {},
        onTarget: () -> Unit = {},
        onImport: (ImportApiMetaRemoteCommand) -> Unit = {},
    ): ImportApiMetaResult {
        val useCase = ImportApiMetaUseCase(
            credentialProvider = object : CredentialProvider {
                override suspend fun resolve(request: CredentialRequest): CredentialResult {
                    touched.credentialResolved = true
                    onCredential(request)
                    return credential
                }

                override suspend fun resolve(
                    apiUrl: ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                ): CredentialResult = error("устаревший вход не должен использоваться")
            },
            apiUrlResolver = ApiUrlResolver(EnvironmentReader(environment)),
            metaSource = object : ApiMetaSource {
                override fun read(path: String): ApiMetaSourceResult {
                    touched.read = true
                    return meta
                }
            },
            remoteSource = object : ApiMetaRemoteSource {
                override suspend fun import(command: ImportApiMetaRemoteCommand): ImportApiMetaRemoteResult {
                    touched.requested = true
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
                from = "meta.json",
                dryRun = dryRun,
                typeMap = typeMap,
                apiUrlOverride = apiUrlOverride,
            ),
            onTarget = { onTarget() },
        )
    }

    private companion object {
        const val META_PATH = "/work/meta/uikit-compose-api-meta.json"
        const val VIEW_META_PATH = "/work/meta/uikit-api-meta.json"

        val REPORT = ApiMetaImportReport(
            createdComponents = 1,
            createdProperties = 2,
            createdStates = 3,
            createdAliases = 4,
            unchangedProperties = 6,
            rejected = listOf(ApiMetaRejection("Box", "odd", "unknown property type: odd")),
            typeMismatches = listOf("Box.size: db=float, meta=dimension"),
        )
    }
}
