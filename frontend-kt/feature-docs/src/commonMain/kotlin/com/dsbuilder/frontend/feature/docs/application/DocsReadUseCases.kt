@file:Suppress("UndocumentedPublicClass", "UndocumentedPublicFunction", "UndocumentedPublicProperty")

package com.dsbuilder.frontend.feature.docs.application

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.serialization.json.JsonElement

public data class DocumentationSearchCommand(
    val query: String,
    val version: String?,
    val platform: String?,
    val cursor: String?,
    val limit: String?,
    val subject: String?,
)

public data class DocumentationFetchCommand(val kbUrl: String)

public data class DocumentationPublicationCommand(val version: String?, val platform: String?)

public data class DocumentationPageCommand(val path: String, val version: String?, val platform: String?)

public data class CodeBindingSearchCommand(
    val subject: String?,
    val kind: String?,
    val name: String?,
    val limit: String?,
    val cursor: String?,
    val version: String?,
    val platform: String?,
)

public data class CodeBindingGetCommand(
    val bindingId: String,
    val publicationId: String?,
    val version: String?,
    val platform: String?,
)

public data class DocsReadRuntime(
    val context: ProjectContext,
    val apiUrl: ProjectApiUrl,
    val credential: BackendCredential,
)

public enum class DocsReadErrorCode {
    AUTH_REQUIRED,
    FORBIDDEN,
    NOT_FOUND,
    PUBLICATION_NOT_FOUND,
    BACKEND_UNAVAILABLE,
    CONTEXT_NOT_FOUND,
    INVALID_QUERY,
}

public sealed interface DocsReadResult {
    public data class Success(val value: JsonElement) : DocsReadResult

    public data class Failed(val code: DocsReadErrorCode, val message: String) : DocsReadResult
}

public interface DocsReadRemoteSource {
    public suspend fun search(runtime: DocsReadRuntime, command: DocumentationSearchCommand): DocsReadResult

    public suspend fun fetch(runtime: DocsReadRuntime, command: DocumentationFetchCommand): DocsReadResult

    public suspend fun navigation(runtime: DocsReadRuntime, command: DocumentationPublicationCommand): DocsReadResult

    public suspend fun page(runtime: DocsReadRuntime, command: DocumentationPageCommand): DocsReadResult

    public suspend fun searchBindings(runtime: DocsReadRuntime, command: CodeBindingSearchCommand): DocsReadResult

    public suspend fun getBinding(runtime: DocsReadRuntime, command: CodeBindingGetCommand): DocsReadResult
}

public class DocsReadUseCases(
    private val contextResolver: ContextResolver,
    private val apiUrlResolver: ApiUrlResolver,
    private val credentialProvider: CredentialProvider,
    private val remoteSource: DocsReadRemoteSource,
) {
    public suspend fun search(
        command: DocumentationSearchCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): DocsReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.search(it, command) }

    public suspend fun fetch(
        command: DocumentationFetchCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): DocsReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.fetch(it, command) }

    public suspend fun navigation(
        command: DocumentationPublicationCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): DocsReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.navigation(it, command) }

    public suspend fun page(
        command: DocumentationPageCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): DocsReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.page(it, command) }

    public suspend fun searchBindings(
        command: CodeBindingSearchCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): DocsReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.searchBindings(it, command) }

    public suspend fun getBinding(
        command: CodeBindingGetCommand,
        apiUrlOverride: String? = null,
        workspace: String? = null,
    ): DocsReadResult =
        withRuntime(apiUrlOverride, workspace) { remoteSource.getBinding(it, command) }

    private suspend fun withRuntime(
        apiUrlOverride: String?,
        workspace: String?,
        block: suspend (DocsReadRuntime) -> DocsReadResult,
    ): DocsReadResult {
        val apiUrl = ProjectApiUrl(apiUrlResolver.resolve(apiUrlOverride).value)
        val context = when (val result = contextResolver.resolve(workspace)) {
            is ProjectContextReadResult.Failed -> return DocsReadResult.Failed(
                DocsReadErrorCode.CONTEXT_NOT_FOUND,
                result.message,
            )
            is ProjectContextReadResult.Found -> result.context
        }
        return when (val credential = credentialProvider.resolve(apiUrl, null, context.credentialEnvName)) {
            is CredentialResult.Failed -> DocsReadResult.Failed(DocsReadErrorCode.AUTH_REQUIRED, credential.message)
            is CredentialResult.Selected -> block(DocsReadRuntime(context, apiUrl, credential.credential))
        }
    }
}
