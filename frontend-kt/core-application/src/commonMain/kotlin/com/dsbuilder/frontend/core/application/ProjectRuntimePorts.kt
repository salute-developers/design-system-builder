package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.ProjectApiKey
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext

/**
 * Port чтения configured project context для клиентов DS Builder.
 */
public fun interface ProjectContextReader {
    /**
     * Возвращает configured project context для указанной или текущей директории.
     */
    public fun requireContext(startingDirectory: String?): ProjectContextReadResult
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
 * Port for selecting a backend credential without exposing the raw secret in public diagnostics.
 */
public interface CredentialProvider {
    /**
     * Selects the credential for one backend API call.
     */
    public suspend fun resolve(
        apiUrl: ProjectApiUrl,
        projectKeyOverride: String?,
        credentialEnvName: CredentialEnvName,
    ): CredentialResult
}

/**
 * Result of credential selection.
 */
public sealed interface CredentialResult {
    /**
     * A credential was selected.
     *
     * @property credential raw runtime credential for backend calls.
     * @property type public credential category safe for diagnostics.
     */
    public data class Selected(
        public val credential: BackendCredential,
        public val type: BackendCredentialType,
    ) : CredentialResult

    /**
     * Credential selection failed.
     *
     * @property code stable machine-readable auth error.
     * @property message user-facing message without secrets.
     */
    public data class Failed(
        public val code: AuthErrorCode,
        public val message: String,
    ) : CredentialResult
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
     * @property reason почему контекста нет: проекта нет вовсе или его config неверен.
     */
    public data class Failed(
        public val message: String,
        public val reason: ProjectContextFailure = ProjectContextFailure.INVALID,
    ) : ProjectContextReadResult
}

/**
 * Причина, по которой project context не прочитан.
 *
 * Команда с историческим умолчанием может продолжить работу без проекта, но не имеет права
 * подменять умолчанием неверный config: иначе опечатка в нём даёт молча собранный чужой результат.
 */
public enum class ProjectContextFailure {
    /** `.sdds/config.json` не найден ни в текущей директории, ни выше. */
    NOT_INITIALIZED,

    /** Config найден, но не читается, не разбирается или содержит неизвестные значения. */
    INVALID,
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
