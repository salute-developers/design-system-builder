@file:Suppress("UndocumentedPublicClass", "UndocumentedPublicFunction", "UndocumentedPublicProperty")

package com.dsbuilder.frontend.feature.docs.application

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.RuntimeFailureCode
import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.core.application.RuntimeRequestResolver
import com.dsbuilder.frontend.core.application.RuntimeResolution
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.feature.docs.domain.DocumentationPlatform
import com.dsbuilder.frontend.feature.docs.domain.toDocumentationPlatform
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
    CONTEXT_REQUIRED,
    INVALID_CONTEXT,
    AMBIGUOUS_CONTEXT,
    INVALID_QUERY,
    PROJECT_KEY_INVALID,
    INVALID_AUTH_URL,
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
        request: RuntimeRequest = RuntimeRequest(),
    ): DocsReadResult =
        withRuntimeAndPlatform(command.platform, request) { runtime, platform ->
            remoteSource.search(
                runtime,
                command.copy(platform = platform, version = command.version ?: runtime.context.selectedVersion),
            )
        }

    public suspend fun fetch(
        command: DocumentationFetchCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): DocsReadResult =
        withRuntime(request) { remoteSource.fetch(it, command) }

    public suspend fun navigation(
        command: DocumentationPublicationCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): DocsReadResult =
        withRuntimeAndPlatform(command.platform, request) { runtime, platform ->
            remoteSource.navigation(
                runtime,
                command.copy(platform = platform, version = command.version ?: runtime.context.selectedVersion),
            )
        }

    public suspend fun page(
        command: DocumentationPageCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): DocsReadResult =
        withRuntimeAndPlatform(command.platform, request) { runtime, platform ->
            remoteSource.page(
                runtime,
                command.copy(platform = platform, version = command.version ?: runtime.context.selectedVersion),
            )
        }

    public suspend fun searchBindings(
        command: CodeBindingSearchCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): DocsReadResult =
        withRuntimeAndPlatform(command.platform, request) { runtime, platform ->
            remoteSource.searchBindings(
                runtime,
                command.copy(platform = platform, version = command.version ?: runtime.context.selectedVersion),
            )
        }

    public suspend fun getBinding(
        command: CodeBindingGetCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): DocsReadResult =
        if (command.publicationId != null) {
            withRuntime(request) { remoteSource.getBinding(it, command) }
        } else {
            withRuntimeAndPlatform(command.platform, request) { runtime, platform ->
                remoteSource.getBinding(
                    runtime,
                    command.copy(platform = platform, version = command.version ?: runtime.context.selectedVersion),
                )
            }
        }

    private suspend fun withRuntimeAndPlatform(
        explicitPlatform: String?,
        request: RuntimeRequest,
        block: suspend (DocsReadRuntime, String) -> DocsReadResult,
    ): DocsReadResult = withRuntime(request) { runtime ->
        when (val resolution = resolveDocumentationPlatform(explicitPlatform, runtime.context.platforms)) {
            is DocsPlatformResolution.Failed -> DocsReadResult.Failed(
                if (explicitPlatform == null) DocsReadErrorCode.AMBIGUOUS_CONTEXT else DocsReadErrorCode.INVALID_QUERY,
                resolution.message,
            )
            is DocsPlatformResolution.Resolved -> block(runtime, resolution.value)
        }
    }

    private val runtimeResolver = RuntimeRequestResolver(contextResolver, apiUrlResolver, credentialProvider)

    private suspend fun withRuntime(
        request: RuntimeRequest,
        block: suspend (DocsReadRuntime) -> DocsReadResult,
    ): DocsReadResult = when (val result = runtimeResolver.resolve(request)) {
        is RuntimeResolution.Failed -> DocsReadResult.Failed(
            when (result.code) {
                RuntimeFailureCode.CONTEXT_REQUIRED -> DocsReadErrorCode.CONTEXT_REQUIRED
                RuntimeFailureCode.INVALID_CONTEXT -> DocsReadErrorCode.INVALID_CONTEXT
                RuntimeFailureCode.CONTEXT_NOT_FOUND -> DocsReadErrorCode.CONTEXT_NOT_FOUND
                RuntimeFailureCode.AUTH_REQUIRED -> DocsReadErrorCode.AUTH_REQUIRED
                RuntimeFailureCode.PROJECT_KEY_INVALID -> DocsReadErrorCode.PROJECT_KEY_INVALID
                RuntimeFailureCode.FORBIDDEN -> DocsReadErrorCode.FORBIDDEN
                RuntimeFailureCode.BACKEND_UNAVAILABLE -> DocsReadErrorCode.BACKEND_UNAVAILABLE
                RuntimeFailureCode.INVALID_AUTH_URL -> DocsReadErrorCode.INVALID_AUTH_URL
            },
            result.message,
        )
        is RuntimeResolution.Resolved -> block(DocsReadRuntime(result.context, result.apiUrl, result.credential))
    }
}

private fun resolveDocumentationPlatform(
    explicit: String?,
    configured: List<TargetPlatform>,
): DocsPlatformResolution {
    if (explicit != null) {
        return DocumentationPlatform.fromManifestValue(explicit)?.let {
            DocsPlatformResolution.Resolved(it.manifestValue)
        } ?: DocsPlatformResolution.Failed(
            "Unknown documentation platform '$explicit'. Supported platforms: " +
                DocumentationPlatform.entries.joinToString { it.manifestValue } + ".",
        )
    }

    val distinct = configured.distinct()
    return when {
        distinct.size == 1 -> DocsPlatformResolution.Resolved(
            distinct.single().toDocumentationPlatform().manifestValue,
        )
        distinct.isEmpty() -> DocsPlatformResolution.Failed(
            "Documentation platform is not set. Pass platform explicitly or add " +
                "\"platforms\": [\"<platform>\"] to .sdds/config.json.",
        )
        else -> DocsPlatformResolution.Failed(
            "Project config declares several platforms (${distinct.joinToString { it.cliValue }}). " +
                "Pass platform explicitly.",
        )
    }
}

private sealed interface DocsPlatformResolution {
    data class Resolved(val value: String) : DocsPlatformResolution

    data class Failed(val message: String) : DocsPlatformResolution
}
