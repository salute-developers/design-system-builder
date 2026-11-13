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
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.components.application.IconCatalogCounts
import com.dsbuilder.frontend.feature.components.application.IconCatalogRemoteSource
import com.dsbuilder.frontend.feature.components.application.IconCatalogReport
import com.dsbuilder.frontend.feature.components.application.IconInUse
import com.dsbuilder.frontend.feature.components.application.IconManifestReadResult
import com.dsbuilder.frontend.feature.components.application.IconManifestStore
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogCommand
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogRemoteCommand
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogRemoteResult
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogResult
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogUseCase
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifest
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifestEntry
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifestSource
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PublishIconCatalogUseCaseTest {
    private val manifest = IconManifest(
        IconManifestSource("@salutejs/sdds-icons", "0.14.0"),
        listOf(IconManifestEntry("AddOutline", "Actions", listOf("add"), mapOf(16 to "<svg/>", 24 to "<svg/>"))),
    )

    private class Touched {
        var read = false
        var credentialResolved = false
        var published: PublishIconCatalogRemoteCommand? = null
        var written: Pair<String, IconManifest>? = null
        var request: CredentialRequest? = null
    }

    private val report = IconCatalogReport(
        outcome = "published",
        loadId = "3fa9c01d27be",
        counts = IconCatalogCounts(added = 1),
        added = listOf("AddOutline"),
    )

    private suspend fun execute(
        command: PublishIconCatalogCommand = PublishIconCatalogCommand(fromDir = "/icons", apiUrlOverride = API),
        read: IconManifestReadResult = IconManifestReadResult.Read(manifest, listOf("NewFill has no size 16, 36.")),
        credential: CredentialResult = CredentialResult.Selected(
            BackendCredential.ServiceToken("service-token"),
            BackendCredentialType.SERVICE_ACCOUNT,
        ),
        remote: PublishIconCatalogRemoteResult = PublishIconCatalogRemoteResult.Published(report),
        writeError: String? = null,
        touched: Touched = Touched(),
        onTarget: () -> Unit = {},
    ): PublishIconCatalogResult {
        val useCase = PublishIconCatalogUseCase(
            credentialProvider = object : CredentialProvider {
                override suspend fun resolve(request: CredentialRequest): CredentialResult {
                    touched.credentialResolved = true
                    touched.request = request
                    return credential
                }

                override suspend fun resolve(
                    apiUrl: ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                ): CredentialResult = error("the legacy entry point must not be used")
            },
            apiUrlResolver = ApiUrlResolver(EnvironmentReader { null }),
            manifestStore = object : IconManifestStore {
                override fun fromDirectory(path: String, packageVersion: String?): IconManifestReadResult {
                    touched.read = true
                    return read
                }

                override fun fromManifest(path: String): IconManifestReadResult {
                    touched.read = true
                    return read
                }

                override fun write(path: String, manifest: IconManifest): String? {
                    touched.written = path to manifest
                    return writeError
                }
            },
            remoteSource = object : IconCatalogRemoteSource {
                override suspend fun publish(command: PublishIconCatalogRemoteCommand): PublishIconCatalogRemoteResult {
                    touched.published = command
                    return remote
                }
            },
        )
        return useCase.execute(command, onTarget = { onTarget() })
    }

    @Test
    fun withoutApplyItIsADryRunWithTheServiceAccountPolicy() = runTest {
        val touched = Touched()
        var targets = 0

        val result = execute(touched = touched, onTarget = { targets++ })

        assertIs<PublishIconCatalogResult.Published>(result)
        assertTrue(result.dryRun)
        assertTrue(result.target.dryRun)
        assertEquals(1, targets)
        assertEquals("@salutejs/sdds-icons", result.target.packageName)
        assertEquals(1, result.target.iconCount)
        assertEquals(mapOf(16 to 1, 24 to 1), result.target.sizeCounts)
        assertEquals(listOf("NewFill has no size 16, 36."), result.target.warnings)
        assertTrue(touched.published!!.dryRun)
        assertEquals(CredentialPolicy.SERVICE_ACCOUNT_OR_USER_SESSION, touched.request!!.policy)
    }

    @Test
    fun applyWritesAndAllowRemovingUsedIsPassedThrough() = runTest {
        val touched = Touched()

        val result = execute(
            PublishIconCatalogCommand(fromDir = "/icons", apply = true, allowRemovingUsed = true, apiUrlOverride = API),
            touched = touched,
        )

        assertIs<PublishIconCatalogResult.Published>(result)
        assertTrue(!result.dryRun)
        assertTrue(!touched.published!!.dryRun)
        assertTrue(touched.published!!.allowRemovingUsed)
    }

    @Test
    fun theCommandLineVersionOverridesTheSourceVersion() = runTest {
        val touched = Touched()

        execute(
            PublishIconCatalogCommand(from = "/m.json", packageVersion = "9.9.9", apiUrlOverride = API),
            touched = touched,
        )

        assertEquals("9.9.9", touched.published!!.manifest.source.version)
    }

    @Test
    fun exactlyOneSourceIsRequiredBeforeAnyWork() = runTest {
        listOf(
            PublishIconCatalogCommand(apiUrlOverride = API),
            PublishIconCatalogCommand(fromDir = "/icons", from = "/m.json", apiUrlOverride = API),
        ).forEach { command ->
            val touched = Touched()

            val result = execute(command, touched = touched)

            val failed = assertIs<PublishIconCatalogResult.Failed>(result)
            assertTrue(failed.message.contains("--from-dir"), failed.message)
            assertTrue(!touched.read && !touched.credentialResolved && touched.published == null)
        }
    }

    @Test
    fun withoutAnExplicitApiUrlNothingIsReadOrSent() = runTest {
        val touched = Touched()

        val result = execute(PublishIconCatalogCommand(fromDir = "/icons"), touched = touched)

        val failed = assertIs<PublishIconCatalogResult.Failed>(result)
        assertTrue(failed.message.contains("DSBUILDER_API_URL"), failed.message)
        assertTrue(!touched.read && !touched.credentialResolved && touched.published == null)
    }

    @Test
    fun aSourceFailureStopsBeforeTheCredentialAndTheNetwork() = runTest {
        val touched = Touched()

        val result = execute(read = IconManifestReadResult.Failed("Error: no SVG files."), touched = touched)

        assertEquals("Error: no SVG files.", assertIs<PublishIconCatalogResult.Failed>(result).message)
        assertTrue(!touched.credentialResolved && touched.published == null)
    }

    @Test
    fun theManifestIsWrittenBeforeTheRequest() = runTest {
        val touched = Touched()

        execute(
            PublishIconCatalogCommand(fromDir = "/icons", writeManifest = "out.json", apiUrlOverride = API),
            touched = touched,
        )

        assertEquals("out.json", touched.written!!.first)
        assertTrue(touched.published != null)
    }

    @Test
    fun aManifestWriteFailureStopsTheCommand() = runTest {
        val touched = Touched()

        val result = execute(
            PublishIconCatalogCommand(fromDir = "/icons", writeManifest = "out.json", apiUrlOverride = API),
            writeError = "Error: cannot write manifest.",
            touched = touched,
        )

        assertEquals("Error: cannot write manifest.", assertIs<PublishIconCatalogResult.Failed>(result).message)
        assertNull(touched.published)
    }

    @Test
    fun aMissingCredentialExplainsBothWaysToSignIn() = runTest {
        val result = execute(
            credential = CredentialResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Authentication required."),
        )

        val message = assertIs<PublishIconCatalogResult.Failed>(result).message
        assertTrue(message.contains("DSBUILDER_CLIENT_ID") && message.contains("auth login"), message)
    }

    @Test
    fun anInUseConflictCarriesTheIcons() = runTest {
        val items = listOf(IconInUse("DisclosureDownFill", listOf(16), 4))

        val result = execute(remote = PublishIconCatalogRemoteResult.InUse(items, "icons_in_use"))

        val inUse = assertIs<PublishIconCatalogResult.InUse>(result)
        assertEquals(items, inUse.items)
    }

    @Test
    fun aRemoteFailureKeepsTheTarget() = runTest {
        val result = execute(remote = PublishIconCatalogRemoteResult.Failed("Status: forbidden."))

        val failed = assertIs<PublishIconCatalogResult.Failed>(result)
        assertEquals("Status: forbidden.", failed.message)
        assertEquals(1, failed.target?.iconCount)
    }

    private companion object {
        const val API = "http://localhost:8080"
    }
}
