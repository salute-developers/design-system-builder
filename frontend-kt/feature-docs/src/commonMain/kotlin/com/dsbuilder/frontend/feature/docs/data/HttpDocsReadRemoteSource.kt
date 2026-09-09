@file:Suppress("UndocumentedPublicClass")

package com.dsbuilder.frontend.feature.docs.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.docs.application.CodeBindingGetCommand
import com.dsbuilder.frontend.feature.docs.application.CodeBindingSearchCommand
import com.dsbuilder.frontend.feature.docs.application.DocsReadErrorCode
import com.dsbuilder.frontend.feature.docs.application.DocsReadRemoteSource
import com.dsbuilder.frontend.feature.docs.application.DocsReadResult
import com.dsbuilder.frontend.feature.docs.application.DocsReadRuntime
import com.dsbuilder.frontend.feature.docs.application.DocumentationFetchCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationPageCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationPublicationCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationSearchCommand
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

public class HttpDocsReadRemoteSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
    private val json: Json,
) : DocsReadRemoteSource {
    override suspend fun search(runtime: DocsReadRuntime, command: DocumentationSearchCommand): DocsReadResult =
        runtime.get(
            runtime.documentationPath("search") +
                queryString(
                    "designSystemId" to runtime.context.designSystemId.value,
                    "version" to (command.version ?: "0.0.0"),
                    "platform" to (command.platform ?: "web"),
                    "query" to command.query,
                    "cursor" to command.cursor,
                    "limit" to command.limit,
                ) + repeatedQuery("subject", command.subject),
            notFoundCode = DocsReadErrorCode.PUBLICATION_NOT_FOUND,
        )

    override suspend fun fetch(runtime: DocsReadRuntime, command: DocumentationFetchCommand): DocsReadResult =
        runtime.get(
            runtime.documentationPath("kb/fetch") +
                queryString("url" to command.kbUrl),
        )

    override suspend fun navigation(
        runtime: DocsReadRuntime,
        command: DocumentationPublicationCommand,
    ): DocsReadResult {
        val publicationId = activePublicationId(runtime, command) ?: return DocsReadResult.Failed(
            DocsReadErrorCode.PUBLICATION_NOT_FOUND,
            "Active documentation publication was not found.",
        )
        return runtime.get(
            runtime.documentationPath("publications/$publicationId/navigation"),
        )
    }

    override suspend fun page(runtime: DocsReadRuntime, command: DocumentationPageCommand): DocsReadResult {
        val publicationId = activePublicationId(
            runtime,
            DocumentationPublicationCommand(command.version, command.platform),
        ) ?: return DocsReadResult.Failed(
            DocsReadErrorCode.PUBLICATION_NOT_FOUND,
            "Active documentation publication was not found.",
        )
        return runtime.get(runtime.docsPublicationPath(publicationId, "pages/${encodePath(command.path)}"))
    }

    override suspend fun searchBindings(runtime: DocsReadRuntime, command: CodeBindingSearchCommand): DocsReadResult {
        val publicationId = activePublicationId(
            runtime,
            DocumentationPublicationCommand(command.version, command.platform),
        ) ?: return DocsReadResult.Failed(
            DocsReadErrorCode.PUBLICATION_NOT_FOUND,
            "Active documentation publication was not found.",
        )
        return runtime.get(
            runtime.documentationPath("publications/$publicationId/bindings") +
                queryString(
                    "subject" to command.subject,
                    "kind" to command.kind,
                    "name" to command.name,
                    "limit" to command.limit,
                    "cursor" to command.cursor,
                ),
        )
    }

    override suspend fun getBinding(runtime: DocsReadRuntime, command: CodeBindingGetCommand): DocsReadResult {
        val publicationId = command.publicationId ?: activePublicationId(
            runtime,
            DocumentationPublicationCommand(command.version, command.platform),
        ) ?: return DocsReadResult.Failed(
            DocsReadErrorCode.PUBLICATION_NOT_FOUND,
            "Active documentation publication was not found.",
        )
        return runtime.get(runtime.docsPublicationPath(publicationId, "bindings/${encodePath(command.bindingId)}"))
    }

    private suspend fun activePublicationId(
        runtime: DocsReadRuntime,
        command: DocumentationPublicationCommand,
    ): String? {
        val result = runtime.get(
            runtime.documentationPath("publications/active") +
                queryString(
                    "designSystemId" to runtime.context.designSystemId.value,
                    "version" to (command.version ?: "0.0.0"),
                    "platform" to (command.platform ?: "web"),
                ),
            notFoundCode = DocsReadErrorCode.PUBLICATION_NOT_FOUND,
        )
        if (result is DocsReadResult.Failed) return null
        val envelope = (result as? DocsReadResult.Success)?.value?.jsonObject ?: return null
        val body = envelope["data"]?.let { runCatching { it.jsonObject }.getOrNull() } ?: envelope
        return body["publicationId"]?.jsonPrimitive?.contentOrNull ?: body["id"]?.jsonPrimitive?.contentOrNull
    }

    private suspend fun DocsReadRuntime.get(
        path: String,
        notFoundCode: DocsReadErrorCode = DocsReadErrorCode.NOT_FOUND,
    ): DocsReadResult =
        when (val response = httpClientFactory.create(apiUrl.value, credential).get(path)) {
            is AuthenticatedHttpResult.Success -> parseSuccess(response.body, "documentation")
            is AuthenticatedHttpResult.Failure -> response.toReadError(notFoundCode)
        }

    private fun parseSuccess(body: String, source: String): DocsReadResult {
        val data = if (body.isBlank()) {
            JsonObject(emptyMap())
        } else {
            runCatching { json.parseToJsonElement(body) }.getOrNull()
                ?: return DocsReadResult.Failed(
                    DocsReadErrorCode.BACKEND_UNAVAILABLE,
                    "Backend returned unreadable JSON.",
                )
        }
        return DocsReadResult.Success(JsonObject(mapOf("source" to JsonPrimitive(source), "data" to data)))
    }
}

private fun AuthenticatedHttpResult.Failure.toReadError(notFoundCode: DocsReadErrorCode): DocsReadResult.Failed {
    val code = when {
        message.contains("unauthorized", ignoreCase = true) -> DocsReadErrorCode.AUTH_REQUIRED
        message.contains("forbidden", ignoreCase = true) -> DocsReadErrorCode.FORBIDDEN
        message.contains("not found", ignoreCase = true) -> notFoundCode
        message.contains("HTTP 400", ignoreCase = true) -> DocsReadErrorCode.INVALID_QUERY
        message.contains("unreachable", ignoreCase = true) -> DocsReadErrorCode.BACKEND_UNAVAILABLE
        else -> DocsReadErrorCode.BACKEND_UNAVAILABLE
    }
    return DocsReadResult.Failed(code, message)
}

private fun queryString(vararg parts: Pair<String, String?>): String {
    val values = parts.filter { it.second != null }.joinToString("&") { (name, value) ->
        "${encode(name)}=${encode(value.orEmpty())}"
    }
    return if (values.isEmpty()) "" else "?$values"
}

private fun repeatedQuery(name: String, value: String?): String =
    value
        ?.split(",")
        ?.filter(String::isNotBlank)
        ?.joinToString("") { "&${encode(name)}=${encode(it.trim())}" }
        .orEmpty()

private fun encodePath(value: String): String = value.split("/").joinToString("/") { encode(it) }

private fun encode(value: String): String = buildString {
    value.encodeToByteArray().forEach { byte ->
        val int = byte.toInt() and 0xff
        val char = int.toChar()
        if (char.isLetterOrDigit() || char in "-._~") {
            append(char)
        } else {
            append("%" + int.toString(16).uppercase().padStart(2, '0'))
        }
    }
}

private fun DocsReadRuntime.docsPublicationPath(publicationId: String, path: String): String =
    documentationPath("publications/$publicationId/$path")

private fun DocsReadRuntime.documentationPath(path: String): String =
    "/api/projects/${context.projectId.value}/documentation/${path.trimStart('/')}"
