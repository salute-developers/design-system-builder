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
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.components.application.PreviewPluginArchive
import com.dsbuilder.frontend.feature.components.application.PreviewPluginArchiveResult
import com.dsbuilder.frontend.feature.components.application.PreviewPluginArchiveSource
import com.dsbuilder.frontend.feature.components.application.PreviewPluginRemoteSource
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginCommand
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginRemoteCommand
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginRemoteResult
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginResult
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginUseCase
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaImportReport
import com.dsbuilder.frontend.feature.components.domain.apimeta.ComposeApiMetaNormalizer
import kotlinx.coroutines.test.runTest
import okio.ByteString.Companion.encodeUtf8
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class PublishPreviewPluginUseCaseTest {
    private val meta = COMPOSE_API_META_CORPUS.encodeToByteArray()
    private val metaSha = COMPOSE_API_META_CORPUS.encodeUtf8().sha256().hex()

    private fun manifest(
        version: String = "0123456789ab",
        uikit: String = "0.55.0",
        sha: String? = metaSha,
    ) = buildString {
        append("""{"version":"$version","uikitComposeVersion":"$uikit"""")
        if (sha != null) append(""","apiMetaSha256":"$sha"""")
        append("}")
    }

    private fun archive(manifestText: String = manifest(), metaBytes: ByteArray = meta) =
        PreviewPluginArchive("/work/preview-compose-plugin.zip", byteArrayOf(1, 2, 3), manifestText, metaBytes)

    private class Touched {
        var read = false
        var credentialResolved = false
        var published = false
    }

    private val published = PublishPreviewPluginRemoteResult.Published(
        outcome = "published",
        buildId = "0123456789ab",
        uikitComposeVersion = "0.55.0",
        pluginUrl = "https://plugins.example.test/builds/0123456789ab/",
        report = ApiMetaImportReport(1, 2, 3, 4, 0, 0, 0, 0, emptyList(), emptyList(), emptyList()),
    )

    private suspend fun execute(
        platform: TargetPlatform = TargetPlatform.COMPOSE,
        apply: Boolean = false,
        apiUrlOverride: String? = "http://localhost:8080",
        archive: PreviewPluginArchiveResult = PreviewPluginArchiveResult.Read(archive()),
        credential: CredentialResult = CredentialResult.Selected(
            BackendCredential.ServiceToken("service-token"),
            BackendCredentialType.SERVICE_ACCOUNT,
        ),
        remote: PublishPreviewPluginRemoteResult = published,
        touched: Touched = Touched(),
        onCredential: (CredentialRequest) -> Unit = {},
        onPublish: (PublishPreviewPluginRemoteCommand) -> Unit = {},
        onTarget: () -> Unit = {},
    ): PublishPreviewPluginResult {
        val useCase = PublishPreviewPluginUseCase(
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
                ): CredentialResult = error("the legacy entry point must not be used")
            },
            apiUrlResolver = ApiUrlResolver(EnvironmentReader { null }),
            archiveSource = object : PreviewPluginArchiveSource {
                override fun read(path: String): PreviewPluginArchiveResult {
                    touched.read = true
                    return archive
                }
            },
            remoteSource = object : PreviewPluginRemoteSource {
                override suspend fun publish(
                    command: PublishPreviewPluginRemoteCommand,
                ): PublishPreviewPluginRemoteResult {
                    touched.published = true
                    onPublish(command)
                    return remote
                }
            },
            normalizer = ComposeApiMetaNormalizer(),
        )
        return useCase.execute(
            PublishPreviewPluginCommand(platform, "plugin.zip", apply, apiUrlOverride),
            onTarget = { onTarget() },
        )
    }

    @Test
    fun sendsTheArchiveAndTheNormalizedMetaOnceAsADryRunByDefault() = runTest {
        val sent = mutableListOf<PublishPreviewPluginRemoteCommand>()

        val result = execute(onPublish = { sent += it })

        assertIs<PublishPreviewPluginResult.Published>(result, "publication refused: $result")
        val command = sent.single()
        assertTrue(command.dryRun)
        assertEquals("http://localhost:8080", command.apiUrl.value)
        assertEquals(BackendCredential.ServiceToken("service-token"), command.credential)
        assertEquals("api-meta.json", command.source)
        assertEquals(listOf("Avatar", "DropZone", "Slider"), command.manifest.components.map { it.name })
        assertEquals(listOf<Byte>(1, 2, 3), command.archive.zipBytes.toList())
    }

    @Test
    fun applyWritesTheBuild() = runTest {
        val sent = mutableListOf<PublishPreviewPluginRemoteCommand>()

        val result = execute(apply = true, onPublish = { sent += it })

        assertEquals(false, sent.single().dryRun)
        assertEquals(false, assertIs<PublishPreviewPluginResult.Published>(result).dryRun)
    }

    @Test
    fun theServiceAccountOrUserSessionPolicyIsRequestedAndNoProjectKeyIsOffered() = runTest {
        val requests = mutableListOf<CredentialRequest>()

        execute(onCredential = { requests += it })

        val request = requests.single()
        assertEquals(CredentialPolicy.SERVICE_ACCOUNT_OR_USER_SESSION, request.policy)
        assertEquals(null, request.projectKeyOverride)
    }

    @Test
    fun theTargetIsPrintedBeforeTheRequestWithTheBuildIdentity() = runTest {
        val order = mutableListOf<String>()

        val result = execute(onTarget = { order += "target" }, onPublish = { order += "publish" })

        assertEquals(listOf("target", "publish"), order)
        val target = assertIs<PublishPreviewPluginResult.Published>(result).target
        assertEquals("0123456789ab/0.55.0", "${target.buildId}/${target.uikitComposeVersion}")
    }

    @Test
    fun onlyTheComposePlatformIsSupported() = runTest {
        val touched = Touched()

        val result = execute(platform = TargetPlatform.REACT, touched = touched)

        assertTrue(assertIs<PublishPreviewPluginResult.Failed>(result).message.contains("compose"))
        assertEquals(false, touched.read)
        assertEquals(false, touched.published)
    }

    @Test
    fun anExplicitApiUrlIsRequiredBecauseTheCommandWrites() = runTest {
        val touched = Touched()

        val result = execute(apiUrlOverride = null, touched = touched)

        assertTrue(assertIs<PublishPreviewPluginResult.Failed>(result).message.contains("DSBUILDER_API_URL"))
        assertEquals(false, touched.read)
        assertEquals(false, touched.published)
    }

    @Test
    fun aMetaThatIsNotFromThisBuildNeverReachesTheBackend() = runTest {
        val touched = Touched()
        val wrongSha = "f".repeat(64)

        val result = execute(
            archive = PreviewPluginArchiveResult.Read(archive(manifest(sha = wrongSha))),
            touched = touched,
        )

        val message = assertIs<PublishPreviewPluginResult.Failed>(result).message
        assertTrue(message.contains(wrongSha), message)
        assertTrue(message.contains(metaSha), message)
        assertEquals(false, touched.credentialResolved)
        assertEquals(false, touched.published)
    }

    @Test
    fun aManifestWithoutTheIdentityFieldsIsRefused() = runTest {
        listOf(
            """{"uikitComposeVersion":"0.55.0","apiMetaSha256":"$metaSha"}""",
            """{"version":"0123456789ab","apiMetaSha256":"$metaSha"}""",
            """{"version":"0123456789ab","uikitComposeVersion":"0.55.0"}""",
            "[]",
            "not json",
        ).forEach { manifestText ->
            val touched = Touched()
            val result = execute(archive = PreviewPluginArchiveResult.Read(archive(manifestText)), touched = touched)

            assertIs<PublishPreviewPluginResult.Failed>(result, manifestText)
            assertEquals(false, touched.published, manifestText)
        }
    }

    @Test
    fun anEmptyMetaIsRefusedBeforeAnyRequest() = runTest {
        val empty = "[]".encodeToByteArray()
        val touched = Touched()

        val result = execute(
            archive = PreviewPluginArchiveResult.Read(archive(manifest(sha = "[]".encodeUtf8().sha256().hex()), empty)),
            touched = touched,
        )

        assertTrue(assertIs<PublishPreviewPluginResult.Failed>(result).message.contains("api-meta.json"))
        assertEquals(false, touched.published)
    }

    @Test
    fun anUnreadableArchiveStopsBeforeTheCredentialIsResolved() = runTest {
        val touched = Touched()

        val result = execute(archive = PreviewPluginArchiveResult.Failed("Error: no archive."), touched = touched)

        assertEquals("Error: no archive.", assertIs<PublishPreviewPluginResult.Failed>(result).message)
        assertEquals(false, touched.credentialResolved)
    }

    @Test
    fun aMissingCredentialExplainsBothWaysToSignIn() = runTest {
        val touched = Touched()

        val result = execute(
            credential = CredentialResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Error: authentication is required."),
            touched = touched,
        )

        val message = assertIs<PublishPreviewPluginResult.Failed>(result).message
        assertTrue(message.contains("DSBUILDER_CLIENT_ID"), message)
        assertTrue(message.contains("DSBUILDER_CLIENT_SECRET"), message)
        assertTrue(message.contains("dsbuilder auth login"), message)
        assertEquals(false, touched.published)
    }

    @Test
    fun aConflictAndABackendFailureAreReportedWithTheTarget() = runTest {
        val conflict = execute(remote = PublishPreviewPluginRemoteResult.Conflict("Build 0123456789ab changed"))
        val failed = execute(remote = PublishPreviewPluginRemoteResult.Failed("Status: forbidden."))

        assertEquals("Build 0123456789ab changed", assertIs<PublishPreviewPluginResult.Conflict>(conflict).message)
        assertEquals("0123456789ab", assertIs<PublishPreviewPluginResult.Conflict>(conflict).target.buildId)
        assertEquals("Status: forbidden.", assertIs<PublishPreviewPluginResult.Failed>(failed).message)
    }

    @Test
    fun unchangedAndActivatedOutcomesArePassedThrough() = runTest {
        listOf("unchanged", "activated").forEach { outcome ->
            val result = execute(remote = published.copy(outcome = outcome))

            assertEquals(outcome, assertIs<PublishPreviewPluginResult.Published>(result).outcome)
        }
    }
}
