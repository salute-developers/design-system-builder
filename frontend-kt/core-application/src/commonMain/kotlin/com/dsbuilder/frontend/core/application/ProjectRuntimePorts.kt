package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectApiKey
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext

/**
 * Inputs for one project-context lookup.
 * @property startingDirectory local search root.
 * @property designSystemUri explicit portable link, when supplied.
 * @property projectKeyEnvName key env name for an explicit link.
 */
public data class ContextRequest(
    public val startingDirectory: String? = null,
    public val designSystemUri: String? = null,
    public val projectKeyEnvName: String? = null,
)

/**
 * Inputs for selecting one backend actor.
 * @property apiUrl resolved backend API URL.
 * @property projectKeyOverride runtime key override.
 * @property credentialEnvName configured key env name.
 * @property policy allowed credential type.
 * @property projectEnvironment values loaded from the selected local project.
 */
public data class CredentialRequest(
    public val apiUrl: ProjectApiUrl,
    public val projectKeyOverride: String? = null,
    public val credentialEnvName: CredentialEnvName,
    public val policy: CredentialPolicy,
    public val projectEnvironment: EnvironmentReader? = null,
)

/** Explicit choice between local discovery and a portable link. */
public sealed interface ContextSelection {
    /** Local context discovery. @property startingDirectory optional search root. */
    public data class Local(public val startingDirectory: String? = null) : ContextSelection

    /** Portable link selection. @property uri link. @property projectKeyEnvName optional key env name. */
    public data class Link(
        public val uri: String,
        public val projectKeyEnvName: String? = null,
    ) : ContextSelection
}

/**
 * Immutable context and runtime overrides for one project-scoped call.
 * @property selection local or explicit resource selection.
 * @property apiUrlOverride backend API URL override.
 * @property projectKeyOverride runtime key override.
 */
public data class RuntimeRequest(
    public val selection: ContextSelection = ContextSelection.Local(),
    public val apiUrlOverride: String? = null,
    public val projectKeyOverride: String? = null,
) {
    /** Context-reader input derived from the typed selection. */
    public val context: ContextRequest
        get() = when (val selected = selection) {
            is ContextSelection.Local -> ContextRequest(startingDirectory = selected.startingDirectory)
            is ContextSelection.Link -> ContextRequest(
                designSystemUri = selected.uri,
                projectKeyEnvName = selected.projectKeyEnvName,
            )
        }
}

/** Port for resolving the project context of one call. */
public fun interface ProjectContextReader {
    /**
     * Возвращает configured project context для указанной или текущей директории.
     */
    public fun requireContext(startingDirectory: String?): ProjectContextReadResult

    /** Rejects explicit selection when a legacy reader has no link support. */
    public fun requireContext(request: ContextRequest): ProjectContextReadResult =
        if (request.designSystemUri == null && request.projectKeyEnvName == null) {
            requireContext(request.startingDirectory)
        } else {
            ProjectContextReadResult.Failed(
                "Explicit design-system selection is not supported by this context reader.",
                ProjectContextFailure.INVALID_CONTEXT,
            )
        }

    /** Resolves one explicit link without changing the reader's local context. */
    public fun requireContext(startingDirectory: String?, designSystemUri: String?): ProjectContextReadResult =
        requireContext(ContextRequest(startingDirectory, designSystemUri))

    /** Selects one explicit link and optional project key environment variable. */
    public fun requireContext(
        startingDirectory: String?,
        designSystemUri: String?,
        projectKeyEnvName: String?,
    ): ProjectContextReadResult = requireContext(ContextRequest(startingDirectory, designSystemUri, projectKeyEnvName))
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

    /** Разрешает URL с необязательными значениями локального проекта. */
    public fun resolve(override: String?, projectEnvironment: EnvironmentReader?): ProjectApiUrl = resolve(override)
}

/**
 * Port for selecting a backend credential without exposing the raw secret in public diagnostics.
 */
public interface CredentialProvider {
    /**
     * Selects the credential for one backend API call.
     */
    public suspend fun resolve(request: CredentialRequest): CredentialResult =
        resolve(request.apiUrl, request.projectKeyOverride, request.credentialEnvName, request.policy)

    /** Legacy auto-policy entry point. */
    public suspend fun resolve(
        apiUrl: ProjectApiUrl,
        projectKeyOverride: String?,
        credentialEnvName: CredentialEnvName,
    ): CredentialResult

    /** Selects a credential according to the request's explicit policy. */
    public suspend fun resolve(
        apiUrl: ProjectApiUrl,
        projectKeyOverride: String?,
        credentialEnvName: CredentialEnvName,
        policy: CredentialPolicy,
    ): CredentialResult = if (policy == CredentialPolicy.AUTO) {
        resolve(apiUrl, projectKeyOverride, credentialEnvName)
    } else {
        CredentialResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Selected credential policy is not supported.")
    }
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
     * @property projectEnvironment values loaded from the selected local project.
     */
    public data class Found(
        public val context: ProjectContext,
        public val projectEnvironment: EnvironmentReader? = null,
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

    /** An explicit link was supplied but does not match the portable-link contract. */
    INVALID_CONTEXT,

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
