package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.application.ChatToolContext
import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentMutationRequest
import com.dsbuilder.ds.core.application.IdempotentReplayException
import com.dsbuilder.ds.core.application.withIdempotentResponse
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/**
 * Вызов инструмента: строит [DsRequestContext] так же, как маршрут ds-service, и переводит результат use case
 * в [ToolResult]. Предметных правил не содержит.
 */
class DsToolCall(private val tool: String, private val context: ChatToolContext) {
    /** DS хода. */
    val designSystemId: UUID = UUID.fromString(context.designSystemId)

    /** Контекст чтения черновика DS хода. */
    fun readContext(): DsRequestContext = base().copy(version = DRAFT)

    /**
     * Контекст записи, повторяемой через контекст: ключ хода, постоянное имя операции `ai:{tool}|[scope]` и тело
     * команды. Версия не задаётся: запись идёт в активный черновик.
     */
    fun <T : Any> writeContext(
        scope: String,
        body: Any?,
        encode: (T) -> String,
        baseRevision: Long? = null,
        status: Int = OK,
    ): DsRequestContext {
        val key = context.idempotencyKey ?: return base(baseRevision)
        return base(baseRevision).copy(
            mutationRequest = IdempotentMutationRequest(key, "ai:$tool|$scope", body, status),
        ).withIdempotentResponse(encode)
    }

    /** Контекст записи для use case создания, которые ведут повторяемость сами; ключ — [createKey]. */
    fun createContext(baseRevision: Long? = null): DsRequestContext = base(baseRevision)

    /** Ключ идемпотентности для use case создания. */
    val createKey: String? get() = context.idempotencyKey

    /**
     * Выполняет use case и переводит результат; сохранённый ответ повтора по ключу — успешный результат.
     * Метаданные записи (новые ревизии и предупреждения) добавляются к результату и при успехе, и при повторе,
     * поэтому модель видит одно и то же.
     */
    suspend fun <T> respond(encode: (T) -> JsonElement, block: suspend () -> DsResult<T>): ToolResult =
        execute(block) { result -> success(encode(result.value).toString(), result.mutationMetadata) }

    /** Список с продолжением: поля items и nextCursor совпадают с ответом маршрута. */
    suspend fun <T> respondPage(serializer: KSerializer<T>, block: suspend () -> DsResult<T>): ToolResult =
        execute(block) { result ->
            val body = buildJsonObject {
                put("items", Json.encodeToJsonElement(serializer, result.value))
                result.readPage?.nextCursor?.let { put("nextCursor", it) }
            }
            success(body.toString())
        }

    private suspend fun <T> execute(
        block: suspend () -> DsResult<T>,
        encode: (DsResult.Success<T>) -> ToolResult,
    ): ToolResult = try {
        when (val result = block()) {
            is DsResult.Success -> encode(result)
            is DsResult.Failure -> reject(result.error)
        }
    } catch (replay: IdempotentReplayException) {
        success(replay.response.body, replay.response.mutationMetadata)
    }

    private fun base(baseRevision: Long? = null) = DsRequestContext(
        principal = context.principal,
        correlationId = context.correlationId,
        baseRevision = baseRevision,
        designSystemId = designSystemId,
        expectedDraftId = context.expectedDraftId?.let(UUID::fromString),
    )

    private fun success(content: String, mutationMetadata: String? = null): ToolResult {
        val metadata = mutationMetadata?.let { runCatching { Json.parseToJsonElement(it) }.getOrNull() }
        val body = if (metadata == null) {
            content
        } else {
            buildJsonObject {
                put("result", Json.parseToJsonElement(content))
                put("mutationMetadata", metadata)
            }.toString()
        }
        return ToolResult("", tool, body, isError = false)
    }

    /** Отказ без вызова use case: тот же JSON и код, что у неуспешного результата. */
    fun reject(error: DsFailure): ToolResult {
        val (code, backendCode, message) = errorData(error)
        val body = buildJsonObject {
            put("code", code)
            backendCode?.let { put("backendCode", it) }
            message?.let { put("message", it) }
            (error as? DsFailure.Conflict)?.editRevision?.let { put("editRevision", it) }
            (error as? DsFailure.Conflict)?.draftRevision?.let { put("draftRevision", it) }
            (error as? DsFailure.InvalidRequest)?.details?.takeIf { it.isNotEmpty() }?.let { details ->
                put("details", JsonObject(details.mapValues { JsonPrimitive(it.value) }))
            }
        }
        return ToolResult("", tool, body.toString(), isError = true, code = code, backendCode = backendCode)
    }

    private companion object {
        const val DRAFT = "draft"
        const val OK = 200

        fun errorData(error: DsFailure): Triple<String, String?, String?> = when (error) {
            DsFailure.Forbidden -> Triple("FORBIDDEN", null, null)
            DsFailure.NotFound -> Triple("NOT_FOUND", null, null)
            is DsFailure.InvalidRequest -> Triple("INVALID_ARGUMENT", error.code, error.message)
            is DsFailure.Conflict -> Triple("CONFLICT", error.code, error.message)
            is DsFailure.Unprocessable -> Triple("VALIDATION_FAILED", error.code, error.message)
            is DsFailure.DependencyUnavailable, DsFailure.TechnicalFailure -> Triple("BACKEND_UNAVAILABLE", null, null)
        }
    }
}

/** Преобразует успешное значение, сохраняя ревизии, контекст чтения и продолжение страницы. */
internal fun <T, R> DsResult<T>.map(transform: (T) -> R): DsResult<R> = when (this) {
    is DsResult.Success -> DsResult.Success(transform(value), mutationMetadata, readContext, readPage)
    is DsResult.Failure -> this
}
