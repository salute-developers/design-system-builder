package com.dsbuilder.frontend.feature.status

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusCommand
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusErrorCode
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusResult
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
import com.dsbuilder.frontend.feature.status.application.ProjectAccessResult
import com.dsbuilder.frontend.feature.status.application.ProjectAccessVerifier
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/**
 * Characterization-тесты на текущее поведение [CheckProjectStatusUseCase]: сохраняются перед
 * переносом в отдельный Gradle-модуль `feature-status`.
 */
class CheckProjectStatusUseCaseTest {
    private val context = ProjectContext(
        projectId = ProjectId("project-1"),
        designSystemId = DesignSystemId("ds-1"),
        credentialEnvName = CredentialEnvName("DSBUILDER_API_KEY"),
        configPath = "/work/.sdds/config.json",
    )

    private fun useCase(
        contextReader: ProjectContextReader = object : ProjectContextReader {
            override fun requireContext(startingDirectory: String?): ProjectContextReadResult =
                ProjectContextReadResult.Found(context)
        },
        credentialProvider: CredentialProvider = object : CredentialProvider {
            override suspend fun resolve(
                apiUrl: ProjectApiUrl,
                projectKeyOverride: String?,
                credentialEnvName: CredentialEnvName,
            ): CredentialResult = CredentialResult.Selected(
                credential = BackendCredential.ProjectKey("secret-value"),
                type = BackendCredentialType.PROJECT_KEY,
            )
        },
        apiUrlProvider: ProjectApiUrlProvider = ProjectApiUrlProvider { ProjectApiUrl("https://api.example.com") },
        accessVerifier: ProjectAccessVerifier = ProjectAccessVerifier {
            ProjectAccessResult.Authorized(projectName = "Project 1", designSystemName = "DS 1")
        },
    ) = CheckProjectStatusUseCase(contextReader, apiUrlProvider, credentialProvider, accessVerifier)

    @Test
    fun returnsFailedWhenContextNotFound() = runTest {
        val result = useCase(
            contextReader = object : ProjectContextReader {
                override fun requireContext(startingDirectory: String?): ProjectContextReadResult =
                    ProjectContextReadResult.Failed("Project is not initialized.")
            },
        ).execute(CheckProjectStatusCommand(apiKeyOverride = null, apiUrlOverride = null))

        assertIs<CheckProjectStatusResult.Failed>(result)
        assertEquals("Project is not initialized.", result.message)
        assertEquals(CheckProjectStatusErrorCode.CONTEXT_NOT_FOUND, result.code)
    }

    @Test
    fun returnsFailedWhenApiKeyIsMissing() = runTest {
        val result = useCase(
            credentialProvider = object : CredentialProvider {
                override suspend fun resolve(
                    apiUrl: ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                ): CredentialResult = CredentialResult.Failed(AuthErrorCode.AUTH_REQUIRED, "API key is missing.")
            },
        ).execute(CheckProjectStatusCommand(apiKeyOverride = null, apiUrlOverride = null))

        assertIs<CheckProjectStatusResult.Failed>(result)
        assertEquals("API key is missing.", result.message)
        assertEquals(CheckProjectStatusErrorCode.AUTH_REQUIRED, result.code)
    }

    @Test
    fun resolvesContextFromCommandWorkspace() = runTest {
        var capturedWorkspace: String? = null
        val result = useCase(
            contextReader = object : ProjectContextReader {
                override fun requireContext(startingDirectory: String?): ProjectContextReadResult {
                    capturedWorkspace = startingDirectory
                    return ProjectContextReadResult.Found(context)
                }
            },
        ).execute(
            CheckProjectStatusCommand(
                apiKeyOverride = null,
                apiUrlOverride = null,
                workspace = "/selected/workspace",
            ),
        )

        assertIs<CheckProjectStatusResult.Authorized>(result)
        assertEquals("/selected/workspace", capturedWorkspace)
    }

    @Test
    fun returnsFailedWhenBackendDeniesAccess() = runTest {
        val result = useCase(
            accessVerifier = ProjectAccessVerifier {
                ProjectAccessResult.Failed("Status: forbidden. API key has no access to this project.")
            },
        ).execute(CheckProjectStatusCommand(apiKeyOverride = null, apiUrlOverride = null))

        assertIs<CheckProjectStatusResult.Failed>(result)
        assertEquals("Status: forbidden. API key has no access to this project.", result.message)
    }

    @Test
    fun retriesOnceWhenUserBearerCredentialReceivesUnauthorized() = runTest {
        var credentialCalls = 0
        val credentials = listOf(
            BackendCredential.Bearer("access-old"),
            BackendCredential.Bearer("access-new"),
        )
        val attempts = mutableListOf<BackendCredential>()
        val result = useCase(
            credentialProvider = object : CredentialProvider {
                override suspend fun resolve(
                    apiUrl: ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                ): CredentialResult = CredentialResult.Selected(
                    credential = credentials[credentialCalls++],
                    type = BackendCredentialType.USER_SESSION,
                )
            },
            accessVerifier = ProjectAccessVerifier { check ->
                attempts += check.credential
                if (attempts.size == 1) {
                    ProjectAccessResult.Failed("Status: unauthorized. User session is expired.")
                } else {
                    ProjectAccessResult.Authorized(projectName = "Project 1", designSystemName = "DS 1")
                }
            },
        ).execute(CheckProjectStatusCommand(apiKeyOverride = null, apiUrlOverride = null))

        assertIs<CheckProjectStatusResult.Authorized>(result)
        assertEquals(2, attempts.size)
        assertEquals(credentials[0], attempts[0])
        assertEquals(credentials[1], attempts[1])
        assertEquals(2, credentialCalls)
    }

    @Test
    fun doesNotRetryWithUserSessionWhenProjectKeyIsRejected() = runTest {
        var credentialCalls = 0
        val attempts = mutableListOf<BackendCredential>()
        val result = useCase(
            credentialProvider = object : CredentialProvider {
                override suspend fun resolve(
                    apiUrl: ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                ): CredentialResult {
                    credentialCalls += 1
                    return CredentialResult.Selected(
                        credential = BackendCredential.ProjectKey("project-key"),
                        type = BackendCredentialType.PROJECT_KEY,
                    )
                }
            },
            accessVerifier = ProjectAccessVerifier { check ->
                attempts += check.credential
                ProjectAccessResult.Failed("Status: unauthorized. API key is missing or invalid.")
            },
        ).execute(CheckProjectStatusCommand(apiKeyOverride = null, apiUrlOverride = null))

        assertIs<CheckProjectStatusResult.Failed>(result)
        assertEquals(1, attempts.size)
        assertEquals(BackendCredential.ProjectKey("project-key"), attempts[0])
        assertEquals(1, credentialCalls)
    }

    @Test
    fun doesNotRetryWhenUserBearerCredentialReceivesForbidden() = runTest {
        var credentialCalls = 0
        var attempts = 0
        val result = useCase(
            credentialProvider = object : CredentialProvider {
                override suspend fun resolve(
                    apiUrl: ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                ): CredentialResult {
                    credentialCalls += 1
                    return CredentialResult.Selected(
                        credential = BackendCredential.Bearer("access-token"),
                        type = BackendCredentialType.USER_SESSION,
                    )
                }
            },
            accessVerifier = ProjectAccessVerifier {
                attempts += 1
                ProjectAccessResult.Failed("Status: forbidden. User has no access to this project.")
            },
        ).execute(CheckProjectStatusCommand(apiKeyOverride = null, apiUrlOverride = null))

        assertIs<CheckProjectStatusResult.Failed>(result)
        assertEquals(1, attempts)
        assertEquals(1, credentialCalls)
    }

    @Test
    fun returnsAuthorizedWithContextAndResolvedApiUrl() = runTest {
        val result = useCase().execute(CheckProjectStatusCommand(apiKeyOverride = null, apiUrlOverride = null))

        assertIs<CheckProjectStatusResult.Authorized>(result)
        assertEquals("Project 1", result.projectName)
        assertEquals("DS 1", result.designSystemName)
        assertEquals("/work/.sdds/config.json", result.configPath)
        assertEquals("https://api.example.com", result.apiUrl)
    }
}
