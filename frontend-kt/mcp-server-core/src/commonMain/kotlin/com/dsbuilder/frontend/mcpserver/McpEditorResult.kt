package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.DraftOperationResult
import com.dsbuilder.frontend.core.network.HttpMutationResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

/** Преобразует исход операции без дополнительного чтения после подтверждённой записи. */
internal fun DraftOperationResult.toEditorMcpResult(): McpToolResult = when (this) {
    is DraftOperationResult.Failed -> editorError(code, message)
    is DraftOperationResult.Executed -> when (val result = response) {
        is HttpMutationResult.OutcomeUnknown -> editorError(
            "OUTCOME_UNKNOWN",
            "The write outcome is unknown. Retry the same command with the same key.",
            buildJsonObject { put("idempotencyKey", result.idempotencyKey) },
        )
        is HttpMutationResult.Response ->
            if (result.statusCode in 200..299) successResponse(result) else failureResponse(result)
    }
}

private fun DraftOperationResult.Executed.successResponse(response: HttpMutationResult.Response): McpToolResult {
    val data = response.body.takeIf { it.isNotBlank() }?.let(::parseEditorJson)
    val selectedContext = EditorContext(projectId.canonicalEditorId(), designSystemId.canonicalEditorId())
    val context = editorResultJson.encodeToJsonElement(selectedContext).jsonObject
    val readContext = response.headers["x-ds-read-context"]?.let(::parseEditorJson) as? JsonObject
    val projectMatches = readContext?.get("projectId")?.let {
        it.canonicalEditorIdentity() == context["projectId"]
    } != false
    if (
        readContext != null && (
            readContext["designSystemId"]?.canonicalEditorIdentity() != context["designSystemId"] ||
                !projectMatches
            )
    ) {
        return editorError("BACKEND_UNAVAILABLE", "Backend returned an inconsistent editor context.")
    }
    if (idempotencyKey == null && data == null) {
        return editorError("BACKEND_UNAVAILABLE", "Invalid editor source response.")
    }
    val mutation = idempotencyKey?.let { mutationBody(response, data) }
    return McpToolResult(
        false,
        editorResultJson.encodeToString(EditorResponse(selectedContext, data ?: JsonNull, mutation)),
    )
}

private fun DraftOperationResult.Executed.mutationBody(
    response: HttpMutationResult.Response,
    data: JsonElement?,
): EditorMutation {
    val metadata = response.headers["x-ds-mutation-metadata"]?.let(::parseEditorJson) as? JsonArray
    val invalidBody = response.body.isNotBlank() && data == null
    val truncated = !response.metadataValid || response.headers["x-ds-mutation-metadata-truncated"] == "true" ||
        ("x-ds-mutation-metadata" in response.headers && metadata == null) || invalidBody
    return EditorMutation(
        idempotencyKey = requireNotNull(idempotencyKey),
        statusCode = response.statusCode,
        metadata = metadata ?: JsonArray(emptyList()),
        metadataTruncated = truncated,
        confirmation = response.takeIf { it.confirmationAttempted }?.let(::confirmationBody),
        responseInvalid = true.takeIf { invalidBody },
    )
}

private fun confirmationBody(response: HttpMutationResult.Response): EditorConfirmation {
    val data = JsonObject(response.confirmedReads.mapValues { parseEditorJson(it.value) ?: JsonNull })
    return EditorConfirmation(response.confirmationIncomplete || data.values.any { it == JsonNull }, data)
}

private val editorStatusCategories = mapOf(
    400 to "VALIDATION_FAILED",
    422 to "VALIDATION_FAILED",
    401 to "AUTH_REQUIRED",
    403 to "FORBIDDEN",
    404 to "NOT_FOUND",
    409 to "CONFLICT",
)

private fun failureResponse(response: HttpMutationResult.Response): McpToolResult {
    val category = editorStatusCategories[response.statusCode] ?: "BACKEND_UNAVAILABLE"
    val backend = parseEditorJson(response.body) as? JsonObject
    val backendCode = (backend?.get("code") as? JsonPrimitive)?.content
        ?: (backend?.get("error") as? JsonPrimitive)?.content
    val message = (backend?.get("message") as? JsonPrimitive)?.content?.take(1000)
        ?: "Backend returned HTTP ${response.statusCode}."
    val details = buildJsonObject {
        put("statusCode", response.statusCode)
        backendCode?.let { put("backendCode", it.take(200)) }
        backend?.get("details")?.let { put("backendDetails", sanitizeEditorDetails(it)) }
        (backend?.get("error") as? JsonObject)?.let { put("validation", sanitizeEditorDetails(it)) }
        for (name in listOf("editRevision", "draftId", "draftRevision")) backend?.get(name)?.let { put(name, it) }
    }
    return editorError(category, message, details)
}

internal fun editorError(code: String, message: String, details: JsonObject = JsonObject(emptyMap())): McpToolResult =
    McpToolResult(true, editorResultJson.encodeToString(EditorError(code, message, details)))

private val editorResultJson = Json {
    encodeDefaults = true
    explicitNulls = false
}

@Serializable
private data class EditorContext(
    val projectId: String,
    val designSystemId: String,
    val version: String = "draft",
)

@Serializable
private data class EditorResponse(
    val context: EditorContext,
    val data: JsonElement,
    val mutation: EditorMutation?,
)

@Serializable
private data class EditorMutation(
    val idempotencyKey: String,
    val statusCode: Int,
    val metadata: JsonArray,
    val metadataTruncated: Boolean,
    val confirmation: EditorConfirmation?,
    val responseInvalid: Boolean?,
    val confirmed: Boolean = true,
)

@Serializable
private data class EditorConfirmation(
    val incomplete: Boolean,
    val data: JsonObject,
)

@Serializable
private data class EditorError(
    val code: String,
    val message: String,
    val details: JsonObject,
)

private val secretDetailNames = setOf(
    "authorization",
    "password",
    "apikey",
    "accesstoken",
    "refreshtoken",
    "cookie",
    "credential",
    "credentials",
    "clientsecret",
    "stacktrace",
    "trace",
    "exception",
    "headers",
    "setcookie",
)

private fun sanitizeEditorDetails(value: JsonElement): JsonElement = when (value) {
    is JsonObject ->
        JsonObject(
            value.filterKeys {
                val normalized = it.lowercase().replace("_", "").replace("-", "")
                normalized !in secretDetailNames
            }.mapValues { sanitizeEditorDetails(it.value) },
        )
    is JsonArray -> JsonArray(value.map(::sanitizeEditorDetails))
    else -> value
}

internal fun parseEditorJson(value: String): JsonElement? = try {
    Json.parseToJsonElement(value)
} catch (exception: IllegalArgumentException) {
    null
}

private val editorUuid = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

private fun JsonElement.canonicalEditorIdentity(): JsonElement =
    if (this is JsonPrimitive && isString) {
        JsonPrimitive(content.canonicalEditorId())
    } else {
        this
    }

private fun String.canonicalEditorId(): String = if (editorUuid.matches(this)) lowercase() else this
