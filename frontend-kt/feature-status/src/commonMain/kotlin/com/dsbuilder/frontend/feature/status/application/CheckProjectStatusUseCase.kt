package com.dsbuilder.frontend.feature.status.application

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialRequest
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.core.application.ProjectContextFailure
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext

/**
 * Use case для проверки доступа к configured project командой `dsbuilder status`.
 */
public class CheckProjectStatusUseCase internal constructor(
    private val projectContextReader: ProjectContextReader,
    private val projectApiUrlProvider: ProjectApiUrlProvider,
    private val credentialProvider: CredentialProvider,
    private val projectAccessVerifier: ProjectAccessVerifier,
) {
    /**
     * Проверяет configured project.
     */
    public suspend fun execute(command: CheckProjectStatusCommand): CheckProjectStatusResult {
        val found = when (
            val result = projectContextReader.requireContext(
                command.workspace,
                command.designSystemUri,
                command.projectKeyEnvName,
            )
        ) {
            is ProjectContextReadResult.Found -> result
            is ProjectContextReadResult.Failed -> return CheckProjectStatusResult.Failed(
                message = result.message,
                code = when (result.reason) {
                    ProjectContextFailure.NOT_INITIALIZED -> CheckProjectStatusErrorCode.CONTEXT_REQUIRED
                    ProjectContextFailure.INVALID_CONTEXT -> CheckProjectStatusErrorCode.INVALID_CONTEXT
                    ProjectContextFailure.INVALID -> CheckProjectStatusErrorCode.CONTEXT_NOT_FOUND
                },
            )
        }
        val context = found.context
        val apiUrl = projectApiUrlProvider.resolve(command.apiUrlOverride, found.projectEnvironment)
        val credential = when (
            val result = credentialProvider.resolve(
                CredentialRequest(
                    apiUrl,
                    command.apiKeyOverride,
                    context.credentialEnvName,
                    context.credentialPolicy,
                    found.projectEnvironment,
                ),
            )
        ) {
            is CredentialResult.Failed -> return CheckProjectStatusResult.Failed(
                message = result.message,
                code = result.code.toStatusErrorCode(),
            )
            is CredentialResult.Selected -> result.credential
        }

        return verify(context, apiUrl, credential)
    }

    private suspend fun verify(
        context: ProjectContext,
        apiUrl: ProjectApiUrl,
        credential: BackendCredential,
    ): CheckProjectStatusResult =
        when (
            val result = projectAccessVerifier.verify(
                ProjectAccessCheck(
                    projectId = context.projectId,
                    designSystemId = context.designSystemId,
                    apiUrl = apiUrl,
                    credential = credential,
                ),
            )
        ) {
            is ProjectAccessResult.Authorized -> CheckProjectStatusResult.Authorized(
                projectName = result.projectName,
                designSystemName = result.designSystemName,
                configPath = context.configPath,
                apiUrl = apiUrl.value,
            )
            is ProjectAccessResult.Failed -> CheckProjectStatusResult.Failed(result.message, result.code)
        }
}

/**
 * Command model для [CheckProjectStatusUseCase].
 *
 * @property apiKeyOverride runtime override из `--api-key`.
 * @property apiUrlOverride runtime override из `--api-url`.
 * @property workspace optional starting directory for project context resolution.
 * @property designSystemUri explicit design-system link.
 * @property projectKeyEnvName environment variable for an explicit project key.
 */
public data class CheckProjectStatusCommand(
    public val apiKeyOverride: String?,
    public val apiUrlOverride: String?,
    public val workspace: String? = null,
    public val designSystemUri: String? = null,
    public val projectKeyEnvName: String? = null,
)

/**
 * Stable status error category for non-authorized results.
 */
public enum class CheckProjectStatusErrorCode {
    CONTEXT_REQUIRED,
    INVALID_CONTEXT,

    /** Project context was not found or could not be read. */
    CONTEXT_NOT_FOUND,

    /** A usable backend credential is required. */
    AUTH_REQUIRED,

    /** The supplied project key was rejected. */
    PROJECT_KEY_INVALID,

    /** The backend denied access to the project. */
    FORBIDDEN,

    /** The backend could not be reached or returned an unexpected response. */
    BACKEND_UNAVAILABLE,
}

/**
 * Результат проверки project и design system status.
 */
public sealed interface CheckProjectStatusResult {
    /**
     * Backend подтвердил доступ к project и design system.
     *
     * @property projectName имя project.
     * @property designSystemName имя design system.
     * @property configPath путь найденного `.sdds/config.json`.
     * @property apiUrl resolved API URL.
     */
    public data class Authorized(
        public val projectName: String,
        public val designSystemName: String,
        public val configPath: String,
        public val apiUrl: String,
    ) : CheckProjectStatusResult

    /**
     * Проверка завершилась ошибкой.
     *
     * @property message user-facing ошибка.
     * @property code stable machine-readable failure category.
     */
    public data class Failed(
        public val message: String,
        public val code: CheckProjectStatusErrorCode = CheckProjectStatusErrorCode.BACKEND_UNAVAILABLE,
    ) : CheckProjectStatusResult
}

private fun AuthErrorCode.toStatusErrorCode(): CheckProjectStatusErrorCode =
    when (this) {
        AuthErrorCode.AUTH_REQUIRED -> CheckProjectStatusErrorCode.AUTH_REQUIRED
        AuthErrorCode.PROJECT_KEY_INVALID -> CheckProjectStatusErrorCode.PROJECT_KEY_INVALID
        AuthErrorCode.FORBIDDEN -> CheckProjectStatusErrorCode.FORBIDDEN
        AuthErrorCode.BACKEND_UNAVAILABLE -> CheckProjectStatusErrorCode.BACKEND_UNAVAILABLE
        AuthErrorCode.INVALID_AUTH_URL -> CheckProjectStatusErrorCode.BACKEND_UNAVAILABLE
    }
