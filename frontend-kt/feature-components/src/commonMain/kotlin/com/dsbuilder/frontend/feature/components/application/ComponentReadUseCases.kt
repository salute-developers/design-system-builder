@file:Suppress("UndocumentedPublicClass", "UndocumentedPublicFunction", "UndocumentedPublicProperty")

package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.serialization.json.JsonElement

public data class ComponentListReadCommand(val query: String?, val platform: String?)

public data class ComponentGetReadCommand(val identifier: String)

public data class ComponentConfigReadCommand(val identifier: String, val style: String?)

public data class ComponentReadRuntime(
    val context: ProjectContext,
    val apiUrl: ProjectApiUrl,
    val credential: BackendCredential,
)

public enum class ComponentReadErrorCode {
    AUTH_REQUIRED,
    FORBIDDEN,
    NOT_FOUND,
    BACKEND_UNAVAILABLE,
    CONTEXT_NOT_FOUND,
    INVALID_QUERY,
}

public sealed interface ComponentReadResult {
    public data class Success(val value: JsonElement) : ComponentReadResult

    public data class Failed(val code: ComponentReadErrorCode, val message: String) : ComponentReadResult
}

public interface ComponentReadRemoteSource {
    public suspend fun list(runtime: ComponentReadRuntime, command: ComponentListReadCommand): ComponentReadResult

    public suspend fun get(runtime: ComponentReadRuntime, command: ComponentGetReadCommand): ComponentReadResult

    public suspend fun config(runtime: ComponentReadRuntime, command: ComponentConfigReadCommand): ComponentReadResult

    public suspend fun styles(runtime: ComponentReadRuntime, command: ComponentGetReadCommand): ComponentReadResult

    public suspend fun variations(runtime: ComponentReadRuntime, command: ComponentGetReadCommand): ComponentReadResult
}

public class ComponentReadUseCases(
    private val contextResolver: ContextResolver,
    private val apiUrlResolver: ApiUrlResolver,
    private val credentialProvider: CredentialProvider,
    private val remoteSource: ComponentReadRemoteSource,
) {
    public suspend fun list(
        command: ComponentListReadCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): ComponentReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.list(it, command) }

    public suspend fun get(
        command: ComponentGetReadCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): ComponentReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.get(it, command) }

    public suspend fun config(
        command: ComponentConfigReadCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): ComponentReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.config(it, command) }

    public suspend fun styles(
        command: ComponentGetReadCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): ComponentReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.styles(it, command) }

    public suspend fun variations(
        command: ComponentGetReadCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): ComponentReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.variations(it, command) }

    private suspend fun withRuntime(
        apiUrlOverride: String?,
        workspace: String?,
        block: suspend (ComponentReadRuntime) -> ComponentReadResult,
    ): ComponentReadResult {
        val apiUrl = ProjectApiUrl(apiUrlResolver.resolve(apiUrlOverride).value)
        val context = when (val result = contextResolver.resolve(workspace)) {
            is ProjectContextReadResult.Failed -> return ComponentReadResult.Failed(
                ComponentReadErrorCode.CONTEXT_NOT_FOUND,
                result.message,
            )
            is ProjectContextReadResult.Found -> result.context
        }
        return when (val credential = credentialProvider.resolve(apiUrl, null, context.credentialEnvName)) {
            is CredentialResult.Failed -> ComponentReadResult.Failed(
                ComponentReadErrorCode.AUTH_REQUIRED,
                credential.message,
            )
            is CredentialResult.Selected -> block(ComponentReadRuntime(context, apiUrl, credential.credential))
        }
    }
}
