@file:Suppress("UndocumentedPublicClass", "UndocumentedPublicFunction", "UndocumentedPublicProperty")

package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.application.RuntimeFailureCode
import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.core.application.RuntimeRequestResolver
import com.dsbuilder.frontend.core.application.RuntimeResolution
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import kotlinx.serialization.json.JsonElement

public data class ComponentReadRuntime(
    val context: ProjectContext,
    val apiUrl: ProjectApiUrl,
    val credential: BackendCredential,
)

public enum class ComponentReadErrorCode {
    AUTH_REQUIRED, FORBIDDEN, NOT_FOUND, BACKEND_UNAVAILABLE, CONTEXT_NOT_FOUND,
    CONTEXT_REQUIRED, INVALID_CONTEXT, INVALID_QUERY, INVALID_SELECTION,
    PROJECT_KEY_INVALID, INVALID_AUTH_URL,
}

public sealed interface ComponentReadResult {
    public data class Success(val value: JsonElement) : ComponentReadResult
    public data class Failed(val code: ComponentReadErrorCode, val message: String) : ComponentReadResult
}

/** Только серверные операции чтения конфигураций, свойств и токен-ссылок. */
public interface ComponentReadRemoteSource {
    public suspend fun configurations(
        runtime: ComponentReadRuntime,
        componentId: String,
        version: String,
        limit: Int,
        cursor: String?,
    ): ComponentReadResult

    public suspend fun resolvedProperties(
        runtime: ComponentReadRuntime,
        appearanceId: String,
        selectedValueIds: List<String>,
        version: String,
    ): ComponentReadResult

    public suspend fun tokenReferences(
        runtime: ComponentReadRuntime,
        appearanceId: String,
        selectedValueIds: List<String>,
        version: String,
    ): ComponentReadResult
}

public class ComponentReadUseCases(
    private val runtimeResolver: RuntimeRequestResolver,
    private val remoteSource: ComponentReadRemoteSource,
) {
    /** Делегирует выбор конфигураций серверу без поиска по имени. */
    public suspend fun configurations(
        componentId: String,
        version: String?,
        limit: Int,
        cursor: String?,
        request: RuntimeRequest = RuntimeRequest(),
    ): ComponentReadResult = withRuntime(request) { runtime ->
        if (componentId.isBlank() || limit !in 1..100) return@withRuntime invalidQuery()
        remoteSource.configurations(
            runtime,
            componentId,
            version ?: runtime.context.selectedVersion ?: "draft",
            limit,
            cursor,
        )
    }

    /** Делегирует разрешение выбранных значений серверу. */
    public suspend fun resolvedProperties(
        appearanceId: String,
        selectedValueIds: List<String>,
        version: String?,
        request: RuntimeRequest = RuntimeRequest(),
    ): ComponentReadResult = withRuntime(request) { runtime ->
        if (appearanceId.isBlank() || selectedValueIds.any(String::isBlank)) return@withRuntime invalidQuery()
        remoteSource.resolvedProperties(
            runtime,
            appearanceId,
            selectedValueIds,
            version ?: runtime.context.selectedVersion ?: "draft",
        )
    }

    /** Делегирует чтение токен-ссылок серверу. */
    public suspend fun tokenReferences(
        appearanceId: String,
        selectedValueIds: List<String>,
        version: String?,
        request: RuntimeRequest = RuntimeRequest(),
    ): ComponentReadResult = withRuntime(request) { runtime ->
        if (appearanceId.isBlank() || selectedValueIds.any(String::isBlank)) return@withRuntime invalidQuery()
        remoteSource.tokenReferences(
            runtime,
            appearanceId,
            selectedValueIds,
            version ?: runtime.context.selectedVersion ?: "draft",
        )
    }

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

private fun invalidQuery(): ComponentReadResult.Failed =
    ComponentReadResult.Failed(ComponentReadErrorCode.INVALID_QUERY, "Invalid component read parameters.")
