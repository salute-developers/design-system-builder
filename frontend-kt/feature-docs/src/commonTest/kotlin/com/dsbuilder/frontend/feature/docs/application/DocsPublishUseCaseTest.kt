package com.dsbuilder.frontend.feature.docs.application

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class DocsPublishUseCaseTest {
    @Test
    fun publishesWithSelectedBearerCredential() = runTest {
        var uploaded: DocsUploadRequest? = null
        val context = ProjectContext(
            ProjectId("project-a"),
            DesignSystemId("ds-a"),
            CredentialEnvName("PROJECT_KEY"),
            "/repo/.sdds/config.json",
            credentialPolicy = CredentialPolicy.USER_SESSION,
        )
        val useCase = DocsPublishUseCase(
            projectContextReader = ProjectContextReader { ProjectContextReadResult.Found(context) },
            credentialProvider = object : CredentialProvider {
                override suspend fun resolve(
                    apiUrl: ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                ): CredentialResult = error("Policy-aware resolution is required")

                override suspend fun resolve(
                    apiUrl: ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                    policy: CredentialPolicy,
                ): CredentialResult {
                    assertEquals(CredentialPolicy.USER_SESSION, policy)
                    return CredentialResult.Selected(
                        BackendCredential.Bearer("access"),
                        BackendCredentialType.USER_SESSION,
                    )
                }
            },
            projectApiUrlProvider = ProjectApiUrlProvider { ProjectApiUrl("https://api.example.com") },
            publisher = object : DocsHttpClient {
                override suspend fun uploadBundle(request: DocsUploadRequest): DocsUploadResult {
                    uploaded = request
                    return DocsUploadResult.Accepted("bundle-a", "job-a", "accepted")
                }
            },
        )

        val result = useCase.execute(DocsPublishCommand("/tmp/bundle.tar.gz", null, null))

        assertIs<DocsPublishResult.Accepted>(result)
        assertEquals(BackendCredential.Bearer("access"), uploaded?.credential)
        assertEquals(ProjectId("project-a"), uploaded?.projectId)
    }
}
