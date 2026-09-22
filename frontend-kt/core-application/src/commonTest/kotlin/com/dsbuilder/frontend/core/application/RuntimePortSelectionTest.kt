package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class RuntimePortSelectionTest {
    @Test
    fun legacyContextReaderRejectsExplicitLink() {
        val reader = ProjectContextReader {
            ProjectContextReadResult.Found(
                ProjectContext(ProjectId("local"), DesignSystemId("local"), CredentialEnvName("KEY"), "/local/config"),
            )
        }

        val result = reader.requireContext(ContextRequest(designSystemUri = "dsbuilder://projects/other"))

        assertEquals(ProjectContextFailure.INVALID_CONTEXT, assertIs<ProjectContextReadResult.Failed>(result).reason)
    }

    @Test
    fun legacyCredentialProviderRejectsForcedPolicy() = runTest {
        val provider = object : CredentialProvider {
            override suspend fun resolve(
                apiUrl: ProjectApiUrl,
                projectKeyOverride: String?,
                credentialEnvName: CredentialEnvName,
            ): CredentialResult = CredentialResult.Selected(
                BackendCredential.ProjectKey("key"),
                BackendCredentialType.PROJECT_KEY,
            )
        }

        val result = provider.resolve(
            CredentialRequest(
                ProjectApiUrl("https://api.example.com"),
                null,
                CredentialEnvName("KEY"),
                CredentialPolicy.USER_SESSION,
            ),
        )

        assertIs<CredentialResult.Failed>(result)
    }

    @Test
    fun credentialFailureCategorySurvivesRuntimeResolution() = runTest {
        val context =
            ProjectContext(ProjectId("project"), DesignSystemId("design-system"), CredentialEnvName("KEY"), "")
        val resolver = RuntimeRequestResolver(
            ContextResolver(listOf(ContextSource { ContextSourceResult.Found(context) })),
            ApiUrlResolver(
                object : EnvironmentReader {
                    override fun get(name: String): String? = null
                },
            ),
            object : CredentialProvider {
                override suspend fun resolve(
                    apiUrl: ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                ): CredentialResult = CredentialResult.Failed(
                    AuthErrorCode.BACKEND_UNAVAILABLE,
                    "Token endpoint unavailable",
                )
            },
        )

        val result = resolver.resolve(RuntimeRequest())

        assertEquals(RuntimeFailureCode.BACKEND_UNAVAILABLE, assertIs<RuntimeResolution.Failed>(result).code)
    }
}
