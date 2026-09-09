@file:Suppress("UndocumentedPublicClass", "UndocumentedPublicFunction", "UndocumentedPublicProperty")

package com.dsbuilder.frontend.feature.theme.application

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.serialization.json.JsonElement

public data class TokenListReadCommand(val type: String?, val query: String?)

public data class TokenGetReadCommand(val identifier: String)

public data class TokenValuesReadCommand(
    val identifier: String,
    val tenantId: String?,
    val themeId: String?,
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
    INVALID_QUERY,
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
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): TokenReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.list(it, command) }

    public suspend fun get(
        command: TokenGetReadCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): TokenReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.get(it, command) }

    public suspend fun values(
        command: TokenValuesReadCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): TokenReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.values(it, command) }

    private suspend fun withRuntime(
        apiUrlOverride: String?,
        workspace: String?,
        block: suspend (TokenReadRuntime) -> TokenReadResult,
    ): TokenReadResult {
        val apiUrl = ProjectApiUrl(apiUrlResolver.resolve(apiUrlOverride).value)
        val context = when (val result = contextResolver.resolve(workspace)) {
            is ProjectContextReadResult.Failed -> return TokenReadResult.Failed(
                TokenReadErrorCode.CONTEXT_NOT_FOUND,
                result.message,
            )
            is ProjectContextReadResult.Found -> result.context
        }
        return when (val credential = credentialProvider.resolve(apiUrl, null, context.credentialEnvName)) {
            is CredentialResult.Failed -> TokenReadResult.Failed(TokenReadErrorCode.AUTH_REQUIRED, credential.message)
            is CredentialResult.Selected -> block(TokenReadRuntime(context, apiUrl, credential.credential))
        }
    }
}
