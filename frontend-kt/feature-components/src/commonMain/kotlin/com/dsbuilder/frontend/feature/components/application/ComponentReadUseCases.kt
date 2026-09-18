@file:Suppress("UndocumentedPublicClass", "UndocumentedPublicFunction", "UndocumentedPublicProperty")

package com.dsbuilder.frontend.feature.components.application

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
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

public data class ComponentListReadCommand(val query: String?, val platform: String?)

public data class ComponentGetReadCommand(val identifier: String)

public data class ComponentConfigReadCommand(val identifier: String, val style: String?)

public enum class ComponentConfigView { FULL, TOKEN_REFERENCES }

public data class ComponentProjectedConfigReadCommand(
    val config: ComponentConfigReadCommand,
    val selection: Map<String, String> = emptyMap(),
    val view: ComponentConfigView = ComponentConfigView.FULL,
)

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
    CONTEXT_REQUIRED,
    INVALID_CONTEXT,
    INVALID_QUERY,
    INVALID_SELECTION,
    PROJECT_KEY_INVALID,
    INVALID_AUTH_URL,
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

    public suspend fun tokens(runtime: ComponentReadRuntime): ComponentReadResult
}

public class ComponentReadUseCases(
    private val contextResolver: ContextResolver,
    private val apiUrlResolver: ApiUrlResolver,
    private val credentialProvider: CredentialProvider,
    private val remoteSource: ComponentReadRemoteSource,
) {
    public suspend fun list(
        command: ComponentListReadCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): ComponentReadResult =
        withRuntime(request) { remoteSource.list(it, command) }

    public suspend fun get(
        command: ComponentGetReadCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): ComponentReadResult =
        withRuntime(request) { remoteSource.get(it, command) }

    public suspend fun config(
        command: ComponentConfigReadCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): ComponentReadResult =
        withRuntime(request) { remoteSource.config(it, command) }

    public suspend fun projectedConfig(
        command: ComponentProjectedConfigReadCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): ComponentReadResult = withRuntime(request) { runtime ->
        if (command.view == ComponentConfigView.TOKEN_REFERENCES && command.selection.isEmpty()) {
            return@withRuntime ComponentReadResult.Failed(
                ComponentReadErrorCode.INVALID_SELECTION,
                "selection is required for token-references projection",
            )
        }
        val config = remoteSource.config(runtime, command.config)
        if (config is ComponentReadResult.Failed) return@withRuntime config
        if (command.selection.isEmpty() && command.view == ComponentConfigView.FULL) return@withRuntime config
        val tokenNames = if (command.view == ComponentConfigView.TOKEN_REFERENCES) {
            when (val catalog = remoteSource.tokens(runtime)) {
                is ComponentReadResult.Failed -> return@withRuntime catalog
                is ComponentReadResult.Success -> catalog.value.tokenNames()
                    ?: return@withRuntime unreadable("token catalog")
            }
        } else {
            null
        }
        projectConfig((config as ComponentReadResult.Success).value, command.selection, tokenNames)
    }

    public suspend fun styles(
        command: ComponentGetReadCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): ComponentReadResult =
        withRuntime(request) { remoteSource.styles(it, command) }

    public suspend fun variations(
        command: ComponentGetReadCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): ComponentReadResult =
        withRuntime(request) { remoteSource.variations(it, command) }

    private val runtimeResolver = RuntimeRequestResolver(contextResolver, apiUrlResolver, credentialProvider)

    private suspend fun withRuntime(
        request: RuntimeRequest,
        block: suspend (ComponentReadRuntime) -> ComponentReadResult,
    ): ComponentReadResult = when (val result = runtimeResolver.resolve(request)) {
        is RuntimeResolution.Failed -> ComponentReadResult.Failed(
            when (result.code) {
                RuntimeFailureCode.CONTEXT_REQUIRED -> ComponentReadErrorCode.CONTEXT_REQUIRED
                RuntimeFailureCode.INVALID_CONTEXT -> ComponentReadErrorCode.INVALID_CONTEXT
                RuntimeFailureCode.CONTEXT_NOT_FOUND -> ComponentReadErrorCode.CONTEXT_NOT_FOUND
                RuntimeFailureCode.AUTH_REQUIRED -> ComponentReadErrorCode.AUTH_REQUIRED
                RuntimeFailureCode.PROJECT_KEY_INVALID -> ComponentReadErrorCode.PROJECT_KEY_INVALID
                RuntimeFailureCode.FORBIDDEN -> ComponentReadErrorCode.FORBIDDEN
                RuntimeFailureCode.BACKEND_UNAVAILABLE -> ComponentReadErrorCode.BACKEND_UNAVAILABLE
                RuntimeFailureCode.INVALID_AUTH_URL -> ComponentReadErrorCode.INVALID_AUTH_URL
            },
            result.message,
        )
        is RuntimeResolution.Resolved -> block(ComponentReadRuntime(result.context, result.apiUrl, result.credential))
    }
}

private val projectionJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = false
    explicitNulls = false
}

@Suppress("ReturnCount")
private fun projectConfig(
    value: JsonElement,
    selection: Map<String, String>,
    tokenNames: Set<String>?,
): ComponentReadResult {
    val envelope = value as? JsonObject ?: return unreadable("component config")
    val data = envelope["data"] ?: return unreadable("component config")
    val config = runCatching { projectionJson.decodeFromJsonElement(ConfigPackageDto.serializer(), data) }
        .getOrNull() ?: return unreadable("component config")
    return when (val projected = ComponentConfigProjector.project(config, selection, tokenNames)) {
        is ComponentConfigProjection.InvalidSelection -> ComponentReadResult.Failed(
            ComponentReadErrorCode.INVALID_SELECTION,
            projected.reason,
        )
        is ComponentConfigProjection.Success -> {
            val projectedData = projectionJson.encodeToJsonElement(ConfigPackageDto.serializer(), projected.value)
            ComponentReadResult.Success(JsonObject(envelope + ("data" to projectedData)))
        }
    }
}

private fun JsonElement.tokenNames(): Set<String>? = runCatching {
    val data = (this as JsonObject)["data"] as JsonArray
    data.map { (it as JsonObject).getValue("name").jsonPrimitive.content }.toSet()
}.getOrNull()

private fun unreadable(subject: String): ComponentReadResult.Failed = ComponentReadResult.Failed(
    ComponentReadErrorCode.BACKEND_UNAVAILABLE,
    "Backend returned unreadable $subject.",
)
