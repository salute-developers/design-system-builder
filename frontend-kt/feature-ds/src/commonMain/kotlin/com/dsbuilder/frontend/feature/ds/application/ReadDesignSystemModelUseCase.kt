package com.dsbuilder.frontend.feature.ds.application

import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.core.application.RuntimeRequestResolver
import com.dsbuilder.frontend.core.application.RuntimeResolution
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectContext
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

internal data class ModelReadRuntime(
    val context: ProjectContext,
    val apiUrl: String,
    val credential: BackendCredential,
)

internal fun interface ModelReadRemoteSource {
    suspend fun read(runtime: ModelReadRuntime, command: ModelReadCommand): ModelReadResult
}

/** Разрешает контекст и credentials один раз и передаёт простое чтение серверу. */
public class ReadDesignSystemModelUseCase internal constructor(
    private val runtimeResolver: RuntimeRequestResolver,
    private val remote: ModelReadRemoteSource,
) {
    /** Не вычисляет версии, предметные фильтры и страницы локально. */
    public suspend fun execute(
        command: ModelReadCommand,
        request: RuntimeRequest = RuntimeRequest(),
    ): ModelReadResult {
        val invalidLimit = command.limit != null && command.limit !in 1..200
        val conflictingNames = command.filters["name"] != null && command.filters["query"] != null
        if (invalidLimit || conflictingNames) {
            return ModelReadResult.Failed("INVALID_QUERY", "Invalid model read parameters.")
        }
        return when (val runtime = runtimeResolver.resolve(request)) {
            is RuntimeResolution.Failed -> ModelReadResult.Failed(runtime.code.name, runtime.message)
            is RuntimeResolution.Resolved -> readResolved(command, runtime)
        }
    }

    private suspend fun readResolved(command: ModelReadCommand, runtime: RuntimeResolution.Resolved): ModelReadResult {
        val version = when (command.operation) {
            ModelReadOperation.COMPONENT, ModelReadOperation.VERSIONS -> command.version
            else -> command.version ?: runtime.context.selectedVersion ?: "draft"
        }
        if (version != null && version != "draft" && !EXACT_VERSION.matches(version)) {
            return ModelReadResult.Failed("INVALID_QUERY", "An exact model version or draft is required.")
        }
        val result = remote.read(
            ModelReadRuntime(runtime.context, runtime.apiUrl.value, runtime.credential),
            command.copy(version = version),
        )
        return if (command.operation == ModelReadOperation.CONTEXT && result is ModelReadResult.Success) {
            contextResult(runtime, result)
        } else {
            result
        }
    }

    private fun contextResult(runtime: RuntimeResolution.Resolved, result: ModelReadResult.Success): ModelReadResult {
        val payload = result.value as? JsonObject
            ?: return ModelReadResult.Failed("BACKEND_UNAVAILABLE", "Invalid context response.")
        val actual = payload["context"] as? JsonObject
            ?: return ModelReadResult.Failed("BACKEND_UNAVAILABLE", "Invalid context metadata.")
        val configPath = runtime.context.configPath.takeIf(String::isNotEmpty)?.let(::JsonPrimitive) ?: JsonNull
        val platform = runtime.context.platforms.singleOrNull()?.cliValue?.let(::JsonPrimitive) ?: JsonNull
        return ModelReadResult.Success(
            JsonObject(
                payload + mapOf(
                    "projectId" to JsonPrimitive(runtime.context.projectId.value),
                    "designSystemId" to actual.getValue("designSystemId"),
                    "version" to actual.getValue("version"),
                    "configPath" to configPath,
                    "apiUrl" to JsonPrimitive(runtime.apiUrl.value),
                    "credentialType" to JsonPrimitive(
                        when (runtime.credential) {
                            is BackendCredential.ProjectKey -> "PROJECT_KEY"
                            is BackendCredential.Bearer -> "USER_SESSION"
                        },
                    ),
                    "provenance" to JsonPrimitive(runtime.context.provenance.name.lowercase().replace('_', '-')),
                    "platform" to platform,
                ),
            ),
        )
    }

    private companion object {
        val EXACT_VERSION = Regex("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)")
    }
}
