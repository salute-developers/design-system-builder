package com.dsbuilder.frontend.feature.status

import com.dsbuilder.frontend.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.core.application.ProjectApiKeyResult
import com.dsbuilder.frontend.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiKey
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusCommand
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusResult
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
import com.dsbuilder.frontend.feature.status.application.ProjectAccessResult
import com.dsbuilder.frontend.feature.status.application.ProjectAccessVerifier
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
        contextReader: ProjectContextReader = ProjectContextReader { ProjectContextReadResult.Found(context) },
        apiKeyProvider: ProjectApiKeyProvider = ProjectApiKeyProvider { _, _ ->
            ProjectApiKeyResult.Found(ProjectApiKey("secret-value"))
        },
        apiUrlProvider: ProjectApiUrlProvider = ProjectApiUrlProvider { ProjectApiUrl("https://api.example.com") },
        accessVerifier: ProjectAccessVerifier = ProjectAccessVerifier {
            ProjectAccessResult.Authorized(projectName = "Project 1", designSystemName = "DS 1")
        },
    ) = CheckProjectStatusUseCase(contextReader, apiKeyProvider, apiUrlProvider, accessVerifier)

    @Test
    fun returnsFailedWhenContextNotFound() {
        val result = useCase(
            contextReader = ProjectContextReader { ProjectContextReadResult.Failed("Project is not initialized.") },
        ).execute(CheckProjectStatusCommand(apiKeyOverride = null, apiUrlOverride = null))

        assertIs<CheckProjectStatusResult.Failed>(result)
        assertEquals("Project is not initialized.", result.message)
    }

    @Test
    fun returnsFailedWhenApiKeyIsMissing() {
        val result = useCase(
            apiKeyProvider = ProjectApiKeyProvider { _, _ -> ProjectApiKeyResult.Missing("API key is missing.") },
        ).execute(CheckProjectStatusCommand(apiKeyOverride = null, apiUrlOverride = null))

        assertIs<CheckProjectStatusResult.Failed>(result)
        assertEquals("API key is missing.", result.message)
    }

    @Test
    fun returnsFailedWhenBackendDeniesAccess() {
        val result = useCase(
            accessVerifier = ProjectAccessVerifier {
                ProjectAccessResult.Failed("Status: forbidden. API key has no access to this project.")
            },
        ).execute(CheckProjectStatusCommand(apiKeyOverride = null, apiUrlOverride = null))

        assertIs<CheckProjectStatusResult.Failed>(result)
        assertEquals("Status: forbidden. API key has no access to this project.", result.message)
    }

    @Test
    fun returnsAuthorizedWithContextAndResolvedApiUrl() {
        val result = useCase().execute(CheckProjectStatusCommand(apiKeyOverride = null, apiUrlOverride = null))

        assertIs<CheckProjectStatusResult.Authorized>(result)
        assertEquals("Project 1", result.projectName)
        assertEquals("DS 1", result.designSystemName)
        assertEquals("/work/.sdds/config.json", result.configPath)
        assertEquals("https://api.example.com", result.apiUrl)
    }
}
