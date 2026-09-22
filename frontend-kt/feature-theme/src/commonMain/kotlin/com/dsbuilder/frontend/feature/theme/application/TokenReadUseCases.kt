@file:Suppress("UndocumentedPublicClass", "UndocumentedPublicFunction", "UndocumentedPublicProperty")

package com.dsbuilder.frontend.feature.theme.application

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.RuntimeFailureCode
import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.core.application.RuntimeRequestResolver
import com.dsbuilder.frontend.core.application.RuntimeResolution
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.serialization.json.JsonElement

public data class TokenListReadCommand(val type: String?, val query: String?)

public data class TokenGetReadCommand(val tokenId: String)

public data class TokenValuesReadCommand(
    val tokenId: String,
    val tenantId: String?,
    val mode: String?,
    val platform: String?,
)

public data class TokenReadRuntime(
    val context: ProjectContext,
    val apiUrl: ProjectApiUrl,
    val credential: BackendCredential,
)

public enum class TokenReadErrorCode {
    AUTH_REQUIRED,
    FORBIDDEN,
    NOT_FOUND,
    BACKEND_UNAVAILABLE,
    CONTEXT_NOT_FOUND,
    CONTEXT_REQUIRED,
    INVALID_CONTEXT,
    INVALID_QUERY,
    PROJECT_KEY_INVALID,
    INVALID_AUTH_URL,
}

public sealed interface TokenReadResult {
    public data class Success(val value: JsonElement) : TokenReadResult

    public data class Failed(val code: TokenReadErrorCode, val message: String) : TokenReadResult
}

public interface TokenReadRemoteSource {
    public suspend fun list(runtime: TokenReadRuntime, command: TokenListReadCommand): TokenReadResult

    public suspend fun get(runtime: TokenReadRuntime, command: TokenGetReadCommand): TokenReadResult

    public suspend fun values(runtime: TokenReadRuntime, command: TokenValuesReadCommand): TokenReadResult
}

public class TokenReadUseCases(
    private val contextResolver: ContextResolver,
    private val apiUrlResolver: ApiUrlResolver,
    private val credentialProvider: CredentialProvider,
    private val remoteSource: TokenReadRemoteSource,
) {
    public suspend fun list(
        command: TokenListReadCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): TokenReadResult =
        withRuntime(request) { remoteSource.list(it, command) }

    public suspend fun get(
        command: TokenGetReadCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): TokenReadResult =
        withRuntime(request) { remoteSource.get(it, command) }

    public suspend fun values(
        command: TokenValuesReadCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): TokenReadResult =
        withRuntime(request) { remoteSource.values(it, command) }

    private val runtimeResolver = RuntimeRequestResolver(contextResolver, apiUrlResolver, credentialProvider)

    private suspend fun withRuntime(
        request: RuntimeRequest,
        block: suspend (TokenReadRuntime) -> TokenReadResult,
    ): TokenReadResult = when (val result = runtimeResolver.resolve(request)) {
        is RuntimeResolution.Failed -> TokenReadResult.Failed(
            when (result.code) {
                RuntimeFailureCode.CONTEXT_REQUIRED -> TokenReadErrorCode.CONTEXT_REQUIRED
                RuntimeFailureCode.INVALID_CONTEXT -> TokenReadErrorCode.INVALID_CONTEXT
                RuntimeFailureCode.CONTEXT_NOT_FOUND -> TokenReadErrorCode.CONTEXT_NOT_FOUND
                RuntimeFailureCode.AUTH_REQUIRED -> TokenReadErrorCode.AUTH_REQUIRED
                RuntimeFailureCode.PROJECT_KEY_INVALID -> TokenReadErrorCode.PROJECT_KEY_INVALID
                RuntimeFailureCode.FORBIDDEN -> TokenReadErrorCode.FORBIDDEN
                RuntimeFailureCode.BACKEND_UNAVAILABLE -> TokenReadErrorCode.BACKEND_UNAVAILABLE
                RuntimeFailureCode.INVALID_AUTH_URL -> TokenReadErrorCode.INVALID_AUTH_URL
            },
            result.message,
        )
        is RuntimeResolution.Resolved -> block(TokenReadRuntime(result.context, result.apiUrl, result.credential))
    }
}
