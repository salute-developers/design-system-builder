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
import com.dsbuilder.frontend.feature.docs.application.DocumentationPublicationsCommand
import com.dsbuilder.frontend.feature.docs.application.DocumentationSearchCommand
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

public class HttpDocsReadRemoteSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
    private val json: Json,
) : DocsReadRemoteSource {
    override suspend fun publications(
        runtime: DocsReadRuntime,
        command: DocumentationPublicationsCommand,
    ): DocsReadResult =
        runtime.get(
            runtime.documentationPath("publications") + queryString(
                "designSystemId" to runtime.context.designSystemId.value,
                "version" to command.version,
                "platform" to command.platform,
                "limit" to command.limit,
                "cursor" to command.cursor,
            ),
        )

    override suspend fun search(runtime: DocsReadRuntime, command: DocumentationSearchCommand): DocsReadResult {
        val selectedPublicationId = if (command.publicationId == null && command.version == null) {
            val selector = DocumentationPublicationCommand(null, command.platform)
            when (val selected = activePublicationId(runtime, selector)) {
                is PublicationSelection.Found -> selected.id
                is PublicationSelection.Failed -> return if (
                    selected.error.code == DocsReadErrorCode.PUBLICATION_NOT_FOUND
                ) {
                    DocsReadResult.Failed(
                        DocsReadErrorCode.PUBLICATION_NOT_FOUND,
                        "Documentation has not been published for this design system and platform.",
                    )
                } else {
                    selected.error
                }
            }
        } else {
            command.publicationId
        }
        return runtime.get(
            runtime.documentationPath("search") +
                queryString(
                    "designSystemId" to runtime.context.designSystemId.value,
                    "version" to command.version,
                    "platform" to command.platform,
                    "query" to command.query,
                    "cursor" to command.cursor,
                    "limit" to command.limit,
                    "publicationId" to selectedPublicationId,
                ) + if (command.subjects.isNotEmpty()) {
                    command.subjects.joinToString("") { "&subject=${encode(it)}" }
                } else {
                    repeatedQuery("subject", command.subject)
                },
            notFoundCode = DocsReadErrorCode.PUBLICATION_NOT_FOUND,
        ).requireSearchPublication(
            if (selectedPublicationId == null) runtime.context.designSystemId.value else null,
            selectedPublicationId,
            command.version,
            command.platform,
        )
    }

    override suspend fun fetch(runtime: DocsReadRuntime, command: DocumentationFetchCommand): DocsReadResult =
        runtime.get(
            runtime.documentationPath("kb/fetch") +
                queryString("url" to command.kbUrl, "detail" to "compact"),
        )

    override suspend fun navigation(
        runtime: DocsReadRuntime,
        command: DocumentationPublicationCommand,
    ): DocsReadResult = withPublicationId(runtime, command) { publicationId ->
        runtime.get(
            runtime.documentationPath("publications/$publicationId/navigation"),
        ).requirePublication(publicationId, command.version, command.platform)
    }

    override suspend fun page(runtime: DocsReadRuntime, command: DocumentationPageCommand): DocsReadResult =
        withPublicationId(
            runtime,
            DocumentationPublicationCommand(command.version, command.platform, command.publicationId),
        ) { publicationId ->
            runtime.get(runtime.docsPublicationPath(publicationId, "pages/${encodePath(command.path)}"))
                .requirePublication(publicationId, command.version, command.platform)
        }

    override suspend fun searchBindings(runtime: DocsReadRuntime, command: CodeBindingSearchCommand): DocsReadResult =
        withPublicationId(
            runtime,
            DocumentationPublicationCommand(command.version, command.platform, command.publicationId),
        ) { publicationId ->
            runtime.get(
                runtime.documentationPath("publications/$publicationId/bindings") +
                    queryString(
                        "subject" to command.subject,
                        "kind" to command.kind,
                        "name" to command.name,
                        "limit" to command.limit,
                        "cursor" to command.cursor,
                        "detail" to "summary",
                    ),
            ).requirePublication(publicationId, command.version, command.platform)
        }

    override suspend fun getBinding(runtime: DocsReadRuntime, command: CodeBindingGetCommand): DocsReadResult =
        withPublicationId(
            runtime,
            DocumentationPublicationCommand(command.version, command.platform, command.publicationId),
        ) { publicationId ->
            runtime.get(
                runtime.docsPublicationPath(publicationId, "bindings/${encodePath(command.bindingId)}") +
                    queryString("detail" to command.detail) +
                    repeatedValues("appearanceNames", command.appearanceNames, command.detail != null) +
                    repeatedValues(
                        "variationNames", command.variationNames,
                        command.detail != null || command.appearanceNames.isNotEmpty(),
                    ),
            ).requirePublication(publicationId, command.version, command.platform)
        }

    private suspend fun withPublicationId(
        runtime: DocsReadRuntime,
        command: DocumentationPublicationCommand,
        block: suspend (String) -> DocsReadResult,
    ): DocsReadResult = when (val selected = activePublicationId(runtime, command)) {
        is PublicationSelection.Failed -> selected.error
        is PublicationSelection.Found -> block(selected.id)
    }

    @Suppress("ReturnCount")
    private suspend fun activePublicationId(
        runtime: DocsReadRuntime,
        command: DocumentationPublicationCommand,
    ): PublicationSelection {
        command.publicationId?.let { return PublicationSelection.Found(it) }
        val result = runtime.get(
            runtime.documentationPath("publications/active") +
                queryString(
                    "designSystemId" to runtime.context.designSystemId.value,
                    "version" to command.version,
                    "platform" to command.platform,
                ),
            notFoundCode = DocsReadErrorCode.PUBLICATION_NOT_FOUND,
        )
        if (result is DocsReadResult.Failed) return PublicationSelection.Failed(result)
        val envelope = (result as DocsReadResult.Success).value as? JsonObject
            ?: return PublicationSelection.Failed(
                DocsReadResult.Failed(
                    DocsReadErrorCode.BACKEND_UNAVAILABLE, "Backend returned unreadable publication metadata.",
                ),
            )
        val body = envelope["data"]?.let { runCatching { it.jsonObject }.getOrNull() } ?: envelope
        val id = body["publicationId"]?.jsonPrimitive?.contentOrNull ?: body["id"]?.jsonPrimitive?.contentOrNull
        return id?.let(PublicationSelection::Found) ?: PublicationSelection.Failed(
            DocsReadResult.Failed(
                DocsReadErrorCode.BACKEND_UNAVAILABLE, "Backend returned unreadable publication metadata.",
            ),
        )
    }

    private suspend fun DocsReadRuntime.get(
        path: String,
        notFoundCode: DocsReadErrorCode = DocsReadErrorCode.NOT_FOUND,
    ): DocsReadResult =
        when (val response = httpClientFactory.create(apiUrl.value, credential).get(path)) {
            is AuthenticatedHttpResult.Success -> parseSuccess(response, "documentation")
            is AuthenticatedHttpResult.Failure -> response.toReadError(notFoundCode)
        }

    @Suppress("ReturnCount")
    private fun parseSuccess(response: AuthenticatedHttpResult.Success, source: String): DocsReadResult {
        if (!response.readHeadersValid) {
            return DocsReadResult.Failed(
                DocsReadErrorCode.BACKEND_UNAVAILABLE,
                "Backend returned ambiguous publication metadata.",
            )
        }
        val body = response.body
        val data = if (body.isBlank()) {
            JsonObject(emptyMap())
        } else {
            runCatching { json.parseToJsonElement(body) }.getOrNull()
                ?: return DocsReadResult.Failed(
                    DocsReadErrorCode.BACKEND_UNAVAILABLE,
                    "Backend returned unreadable JSON.",
                )
        }
        val context: JsonElement? = response.headers["x-ds-read-context"]?.let { raw ->
            runCatching { json.parseToJsonElement(raw) }.getOrNull()
                ?: return DocsReadResult.Failed(
                    DocsReadErrorCode.BACKEND_UNAVAILABLE,
                    "Backend returned unreadable publication context.",
                )
        }
        return DocsReadResult.Success(
            JsonObject(
                mapOf("source" to JsonPrimitive(source), "data" to data) +
                    (context?.let { mapOf("context" to it) } ?: emptyMap()),
            ),
        )
    }
}

@Suppress("ComplexCondition", "ReturnCount")
private fun DocsReadResult.requirePublication(
    publicationId: String,
    version: String?,
    platform: String?,
): DocsReadResult {
    if (this is DocsReadResult.Failed) return this
    val context = ((this as DocsReadResult.Success).value as? JsonObject)?.get("context") as? JsonObject
        ?: return DocsReadResult.Failed(
            DocsReadErrorCode.BACKEND_UNAVAILABLE, "Backend returned no publication context.",
        )
    val actualId = (context["publicationId"] as? JsonPrimitive)?.contentOrNull
    val actualVersion = (context["version"] as? JsonPrimitive)?.contentOrNull
    val actualPlatform = (context["platform"] as? JsonPrimitive)?.contentOrNull
    if (actualId != publicationId || actualVersion.isNullOrBlank() || actualPlatform.isNullOrBlank()) {
        return DocsReadResult.Failed(
            DocsReadErrorCode.BACKEND_UNAVAILABLE,
            "Backend returned invalid publication context.",
        )
    }
    if (version != null && version != actualVersion || platform != null && platform != actualPlatform) {
        return DocsReadResult.Failed(
            DocsReadErrorCode.INVALID_QUERY,
            "Explicit publication selector does not match publication.",
        )
    }
    return this
}

@Suppress("ReturnCount")
private fun DocsReadResult.requireSearchPublication(
    designSystemId: String?,
    publicationId: String?,
    version: String?,
    platform: String?,
): DocsReadResult {
    if (this is DocsReadResult.Failed) return this
    val context = ((this as DocsReadResult.Success).value as? JsonObject)?.get("context") as? JsonObject
        ?: return DocsReadResult.Failed(
            DocsReadErrorCode.BACKEND_UNAVAILABLE, "Backend returned no publication context.",
        )
    val actualDesignSystemId = (context["designSystemId"] as? JsonPrimitive)?.contentOrNull
    if (actualDesignSystemId.isNullOrBlank() || designSystemId != null && actualDesignSystemId != designSystemId) {
        return DocsReadResult.Failed(
            DocsReadErrorCode.BACKEND_UNAVAILABLE,
            "Backend returned invalid publication context.",
        )
    }
    val actualPublicationId = (context["publicationId"] as? JsonPrimitive)?.contentOrNull
        ?.takeIf(String::isNotBlank)
        ?: return DocsReadResult.Failed(
            DocsReadErrorCode.BACKEND_UNAVAILABLE,
            "Backend returned invalid publication context.",
        )
    if (publicationId != null && publicationId != actualPublicationId) {
        return DocsReadResult.Failed(
            DocsReadErrorCode.INVALID_QUERY,
            "Explicit publication selector does not match publication.",
        )
    }
    return requirePublication(actualPublicationId, version, platform)
}

private sealed interface PublicationSelection {
    data class Found(val id: String) : PublicationSelection

    data class Failed(val error: DocsReadResult.Failed) : PublicationSelection
}

private fun AuthenticatedHttpResult.Failure.toReadError(notFoundCode: DocsReadErrorCode): DocsReadResult.Failed {
    val code = when (statusCode) {
        401 -> DocsReadErrorCode.AUTH_REQUIRED
        403 -> DocsReadErrorCode.FORBIDDEN
        404 -> notFoundCode
        400 -> DocsReadErrorCode.INVALID_QUERY
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

private fun repeatedValues(name: String, values: List<String>, hasQuery: Boolean): String =
    values.mapIndexed { index, value ->
        val prefix = if (index == 0 && !hasQuery) "?" else "&"
        "$prefix${encode(name)}=${encode(value)}"
    }.joinToString("")

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
