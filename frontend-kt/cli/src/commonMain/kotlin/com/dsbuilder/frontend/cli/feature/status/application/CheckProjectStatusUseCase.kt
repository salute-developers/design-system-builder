package com.dsbuilder.frontend.cli.feature.status.application

import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyResult
import com.dsbuilder.frontend.cli.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.cli.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.cli.core.application.ProjectContextReader
import com.dsbuilder.frontend.cli.core.domain.ProjectAccessCheck

/**
 * Use case для проверки доступа к configured project командой `dsbuilder status`.
 */
internal class CheckProjectStatusUseCase(
    private val projectContextReader: ProjectContextReader,
    private val projectApiKeyProvider: ProjectApiKeyProvider,
    private val projectApiUrlProvider: ProjectApiUrlProvider,
    private val projectAccessVerifier: ProjectAccessVerifier,
) {
    /**
     * Проверяет configured project.
     */
    internal fun execute(command: CheckProjectStatusCommand): CheckProjectStatusResult {
        val context = when (val result = projectContextReader.requireContext()) {
            is ProjectContextReadResult.Found -> result.context
            is ProjectContextReadResult.Failed -> return CheckProjectStatusResult.Failed(result.message)
        }
        val apiKey = when (
            val result = projectApiKeyProvider.resolve(
                override = command.apiKeyOverride,
                credentialEnvName = context.credentialEnvName,
            )
        ) {
            is ProjectApiKeyResult.Found -> result.value
            is ProjectApiKeyResult.Missing -> return CheckProjectStatusResult.Failed(result.message)
        }
        val apiUrl = projectApiUrlProvider.resolve(command.apiUrlOverride)

        return when (
            val result = projectAccessVerifier.verify(
                ProjectAccessCheck(
                    projectId = context.projectId,
                    designSystemId = context.designSystemId,
                    apiUrl = apiUrl,
                    apiKey = apiKey,
                ),
            )
        ) {
            is ProjectAccessResult.Authorized -> CheckProjectStatusResult.Authorized(
                projectName = result.projectName,
                designSystemName = result.designSystemName,
                configPath = context.configPath,
                apiUrl = apiUrl.value,
            )
            is ProjectAccessResult.Failed -> CheckProjectStatusResult.Failed(result.message)
        }
    }
}

/**
 * Command model для `CheckProjectStatusUseCase`.
 *
 * @property apiKeyOverride runtime override из `--api-key`.
 * @property apiUrlOverride runtime override из `--api-url`.
 */
internal data class CheckProjectStatusCommand(
    val apiKeyOverride: String?,
    val apiUrlOverride: String?,
)

/**
 * Результат проверки project и design system status.
 */
internal sealed interface CheckProjectStatusResult {
    /**
     * Backend подтвердил доступ к project и design system.
     *
     * @property projectName имя project.
     * @property designSystemName имя design system.
     * @property configPath путь найденного `.sdds/config.json`.
     * @property apiUrl resolved API URL.
     */
    data class Authorized(
        val projectName: String,
        val designSystemName: String,
        val configPath: String,
        val apiUrl: String,
    ) : CheckProjectStatusResult

    /**
     * Проверка завершилась ошибкой.
     *
     * @property message user-facing ошибка.
     */
    data class Failed(
        val message: String,
    ) : CheckProjectStatusResult
}
