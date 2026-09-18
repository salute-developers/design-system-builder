package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.network.ApiUrlResolver

/** Stable reason a project-scoped runtime could not be resolved. */
public enum class RuntimeFailureCode {
    /** Neither an explicit link nor a local context is available. */
    CONTEXT_REQUIRED,

    /** The explicit link is invalid. */
    INVALID_CONTEXT,

    /** A local config exists but cannot be used. */
    CONTEXT_NOT_FOUND,

    /** The selected credential is unavailable. */
    AUTH_REQUIRED,

    PROJECT_KEY_INVALID,

    FORBIDDEN,

    BACKEND_UNAVAILABLE,

    INVALID_AUTH_URL,
}

/** Result of resolving all runtime inputs for one call. */
public sealed interface RuntimeResolution {
    /** Resolved values passed to the feature scenario. */
    public data class Resolved(
        /** Resource selected for this call. */
        public val context: ProjectContext,
        /** Backend API URL resolved independently of the resource link. */
        public val apiUrl: ProjectApiUrl,
        /** Credential selected under the context policy. */
        public val credential: BackendCredential,
    ) : RuntimeResolution

    /** Safe, typed failure. */
    public data class Failed(
        /** Stable failure category. */
        public val code: RuntimeFailureCode,
        /** User-facing diagnostic without credentials. */
        public val message: String,
    ) : RuntimeResolution
}

/** Resolves context, API URL, and credential once for each immutable request. */
public class RuntimeRequestResolver(
    private val contextResolver: ContextResolver,
    private val apiUrlResolver: ApiUrlResolver,
    private val credentialProvider: CredentialProvider,
) {
    /** Returns one resolved runtime without storing an active context. */
    public suspend fun resolve(request: RuntimeRequest): RuntimeResolution {
        val found = when (val result = contextResolver.resolve(request.context)) {
            is ProjectContextReadResult.Failed -> return RuntimeResolution.Failed(
                when (result.reason) {
                    ProjectContextFailure.NOT_INITIALIZED -> RuntimeFailureCode.CONTEXT_REQUIRED
                    ProjectContextFailure.INVALID_CONTEXT -> RuntimeFailureCode.INVALID_CONTEXT
                    ProjectContextFailure.INVALID -> RuntimeFailureCode.CONTEXT_NOT_FOUND
                },
                result.message,
            )
            is ProjectContextReadResult.Found -> result
        }
        val context = found.context
        val apiUrl = ProjectApiUrl(apiUrlResolver.resolve(request.apiUrlOverride, found.projectEnvironment).value)
        return when (
            val credential = credentialProvider.resolve(
                CredentialRequest(
                    apiUrl,
                    request.projectKeyOverride,
                    context.credentialEnvName,
                    context.credentialPolicy,
                    found.projectEnvironment,
                ),
            )
        ) {
            is CredentialResult.Failed -> RuntimeResolution.Failed(
                when (credential.code) {
                    AuthErrorCode.AUTH_REQUIRED -> RuntimeFailureCode.AUTH_REQUIRED
                    AuthErrorCode.PROJECT_KEY_INVALID -> RuntimeFailureCode.PROJECT_KEY_INVALID
                    AuthErrorCode.FORBIDDEN -> RuntimeFailureCode.FORBIDDEN
                    AuthErrorCode.BACKEND_UNAVAILABLE -> RuntimeFailureCode.BACKEND_UNAVAILABLE
                    AuthErrorCode.INVALID_AUTH_URL -> RuntimeFailureCode.INVALID_AUTH_URL
                },
                credential.message,
            )
            is CredentialResult.Selected -> RuntimeResolution.Resolved(context, apiUrl, credential.credential)
        }
    }
}
