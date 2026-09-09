package com.dsbuilder.frontend.feature.status.application

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.CredentialEnvName
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
        val context = when (val result = projectContextReader.requireContext(command.workspace)) {
            is ProjectContextReadResult.Found -> result.context
            is ProjectContextReadResult.Failed -> return CheckProjectStatusResult.Failed(
                message = result.message,
                code = CheckProjectStatusErrorCode.CONTEXT_NOT_FOUND,
            )
        }
        val apiUrl = projectApiUrlProvider.resolve(command.apiUrlOverride)
        val credential = when (
            val result = selectCredential(apiUrl, command.apiKeyOverride, context.credentialEnvName)
        ) {
            is CredentialResult.Failed -> return CheckProjectStatusResult.Failed(
                message = result.message,
                code = result.code.toStatusErrorCode(),
            )
            is CredentialResult.Selected -> result.credential
        }

        return verifyWithSingleUserRetry(context, apiUrl, command.apiKeyOverride, credential)
    }

    private suspend fun selectCredential(
        apiUrl: ProjectApiUrl,
        apiKeyOverride: String?,
        credentialEnvName: CredentialEnvName,
    ): CredentialResult =
        when (
            val result = credentialProvider.resolve(
                apiUrl = apiUrl,
                projectKeyOverride = apiKeyOverride,
                credentialEnvName = credentialEnvName,
            )
        ) {
            is CredentialResult.Failed -> result
            is CredentialResult.Selected -> result
        }

    private suspend fun verifyWithSingleUserRetry(
        context: ProjectContext,
        apiUrl: ProjectApiUrl,
        apiKeyOverride: String?,
        credential: BackendCredential,
    ): CheckProjectStatusResult {
        val first = verify(context, apiUrl, credential)
        val shouldRetry = credential is BackendCredential.Bearer &&
            first is CheckProjectStatusResult.Failed &&
            first.message.contains("unauthorized", ignoreCase = true)
        return if (shouldRetry) {
            when (val result = selectCredential(apiUrl, apiKeyOverride, context.credentialEnvName)) {
                is CredentialResult.Failed -> CheckProjectStatusResult.Failed(
                    message = result.message,
                    code = result.code.toStatusErrorCode(),
                )
                is CredentialResult.Selected -> verify(context, apiUrl, result.credential)
            }
        } else {
            first
        }
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
 */
public data class CheckProjectStatusCommand(
    public val apiKeyOverride: String?,
    public val apiUrlOverride: String?,
    public val workspace: String? = null,
)

/**
 * Stable status error category for non-authorized results.
 */
public enum class CheckProjectStatusErrorCode {
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
