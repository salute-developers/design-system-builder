package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.ProjectApiKey
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext

/**
 * Port чтения configured project context для клиентов DS Builder.
 */
public fun interface ProjectContextReader {
    /**
     * Возвращает configured project context для текущей директории.
     */
    public fun requireContext(): ProjectContextReadResult
}

/**
 * Port resolution project API key для клиентов DS Builder.
 */
public fun interface ProjectApiKeyProvider {
    /**
     * Возвращает runtime API key для project context.
     */
    public fun resolve(
        override: String?,
        credentialEnvName: CredentialEnvName,
    ): ProjectApiKeyResult
}

/**
 * Port resolution backend API URL для клиентов DS Builder.
 */
public fun interface ProjectApiUrlProvider {
    /**
     * Возвращает runtime backend API URL.
     */
    public fun resolve(override: String?): ProjectApiUrl
}

/**
 * Результат чтения project context.
 */
public sealed interface ProjectContextReadResult {
    /**
     * Project context найден.
     *
     * @property context найденный project context.
     */
    public data class Found(
        public val context: ProjectContext,
    ) : ProjectContextReadResult

    /**
     * Project context не найден или не прочитан.
     *
     * @property message user-facing ошибка.
     */
    public data class Failed(
        public val message: String,
    ) : ProjectContextReadResult
}

/**
 * Результат resolution API key.
 */
public sealed interface ProjectApiKeyResult {
    /**
     * API key найден.
     *
     * @property value raw API key для runtime request.
     */
    public data class Found(
        public val value: ProjectApiKey,
    ) : ProjectApiKeyResult

    /**
     * API key не найден.
     *
     * @property message user-facing ошибка.
     */
    public data class Missing(
        public val message: String,
    ) : ProjectApiKeyResult
}
