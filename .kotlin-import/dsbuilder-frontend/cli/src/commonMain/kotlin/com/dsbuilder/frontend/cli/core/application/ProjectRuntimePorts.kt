package com.dsbuilder.frontend.cli.core.application

import com.dsbuilder.frontend.cli.core.domain.CredentialEnvName
import com.dsbuilder.frontend.cli.core.domain.ProjectApiKey
import com.dsbuilder.frontend.cli.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.cli.core.domain.ProjectContext

/**
 * Port чтения configured project context для CLI-команд.
 */
internal fun interface ProjectContextReader {
    /**
     * Возвращает configured project context для текущей директории.
     */
    fun requireContext(): ProjectContextReadResult
}

/**
 * Port resolution project API key для CLI-команд.
 */
internal fun interface ProjectApiKeyProvider {
    /**
     * Возвращает runtime API key для project context.
     */
    fun resolve(
        override: String?,
        credentialEnvName: CredentialEnvName,
    ): ProjectApiKeyResult
}

/**
 * Port resolution backend API URL для CLI-команд.
 */
internal fun interface ProjectApiUrlProvider {
    /**
     * Возвращает runtime backend API URL.
     */
    fun resolve(override: String?): ProjectApiUrl
}

/**
 * Результат чтения project context.
 */
internal sealed interface ProjectContextReadResult {
    /**
     * Project context найден.
     *
     * @property context найденный project context.
     */
    data class Found(
        val context: ProjectContext,
    ) : ProjectContextReadResult

    /**
     * Project context не найден или не прочитан.
     *
     * @property message user-facing ошибка.
     */
    data class Failed(
        val message: String,
    ) : ProjectContextReadResult
}

/**
 * Результат resolution API key.
 */
internal sealed interface ProjectApiKeyResult {
    /**
     * API key найден.
     *
     * @property value raw API key для runtime request.
     */
    data class Found(
        val value: ProjectApiKey,
    ) : ProjectApiKeyResult

    /**
     * API key не найден.
     *
     * @property message user-facing ошибка.
     */
    data class Missing(
        val message: String,
    ) : ProjectApiKeyResult
}
