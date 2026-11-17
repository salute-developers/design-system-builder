package com.dsbuilder.ai.chat.data

import com.dsbuilder.ai.chat.application.AgentToolbox
import com.dsbuilder.ai.chat.application.ChatAccess
import com.dsbuilder.ai.chat.application.ChatToolContext
import com.dsbuilder.ai.chat.application.ChatToolDefinition
import com.dsbuilder.ai.chat.application.ChatToolExecutor
import com.dsbuilder.ai.chat.application.ChatToolKind
import com.dsbuilder.ai.chat.data.tools.accepts
import com.dsbuilder.ai.chat.domain.ToolCall
import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ai.chat.domain.ToolSpec
import com.dsbuilder.authorization.ProjectPrincipal
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonObject
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.Duration

/**
 * Инструменты агента из каталога чата.
 *
 * Отбирает инструменты по разрешениям, проверяет аргументы по схеме и отбрасывает поля, которые задаёт сервер.
 * Транзакция ds-service блокирующая и отменой не прерывается, поэтому вызов идёт отдельной задачей в своей
 * области, а ход ждёт его не дольше [callTimeout]. Пока у пользователя не завершён брошенный по таймауту вызов,
 * новый вызов не начинается.
 */
internal class CatalogAgentToolbox(
    catalog: List<ChatToolDefinition>,
    private val executor: ChatToolExecutor,
    private val callTimeout: Duration,
) : AgentToolbox {
    private val definitions = catalog.associateBy { it.name }
    private val calls = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val inFlight = ConcurrentHashMap.newKeySet<Deferred<ToolResult>>()
    private val abandoned = ConcurrentHashMap<String, Deferred<ToolResult>>()

    init {
        val missing = definitions.keys - executor.supportedTools
        check(missing.isEmpty()) { "AI chat tools have no handler: ${missing.sorted().joinToString()}" }
    }

    override fun specs(access: ChatAccess): List<ToolSpec> = definitions.values
        .filter { access.isAllowed(it.permission) }
        .map { ToolSpec(it.name, it.description, it.inputSchema) }

    override fun isAllowed(name: String, access: ChatAccess): Boolean =
        definitions[name]?.let { access.isAllowed(it.permission) } == true

    override fun isWrite(name: String): Boolean = definitions[name]?.kind.let { it != null && it != ChatToolKind.READ }

    override fun isDestructive(name: String): Boolean = definitions[name]?.kind == ChatToolKind.DESTRUCTIVE

    override fun prepare(call: ToolCall): ToolCall? {
        val definition = definitions[call.name] ?: return null
        val arguments = visibleArguments(call.arguments)
        return if (definition.accepts(arguments)) call.copy(arguments = arguments) else null
    }

    override suspend fun execute(prepared: ToolCall, context: ChatToolContext): ToolResult {
        val user = context.principal.actorId
        if (abandoned[user]?.isActive == true) {
            return failure(prepared, BACKEND_UNAVAILABLE, "A previous tool call of this user is still running.")
        }
        abandoned.remove(user)
        val call = calls.async { run(prepared, context) }
        inFlight += call
        call.invokeOnCompletion { inFlight -= call }
        val result = withTimeoutOrNull(callTimeout) { call.await() }
        if (result != null) return result
        abandoned[user] = call
        log.warn("ai tool call abandoned after timeout tool={} correlation={}", prepared.name, context.correlationId)
        return failure(prepared, unknownOutcomeCode(prepared.name), "Tool call timed out.")
    }

    override fun visibleArguments(arguments: JsonObject): JsonObject =
        JsonObject(arguments.filterKeys { it !in SERVER_FIELDS })

    override suspend fun activeDraftId(principal: ProjectPrincipal, designSystemId: String): String? = try {
        withTimeoutOrNull(callTimeout) { executor.activeDraftId(principal, designSystemId) }
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (@Suppress("TooGenericExceptionCaught") failure: Exception) {
        log.warn("ai active draft read failed: {}", failure::class.simpleName)
        null
    }

    /** Ждёт вызовы, которые ещё идут, не дольше [grace]; используется при остановке процесса. */
    suspend fun drain(grace: Duration) {
        withTimeoutOrNull(grace) { inFlight.toList().joinAll() }
    }

    private suspend fun run(prepared: ToolCall, context: ChatToolContext): ToolResult = try {
        executor.execute(prepared.name, prepared.arguments, context).copy(callId = prepared.id, name = prepared.name)
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (@Suppress("TooGenericExceptionCaught") failure: Exception) {
        log.warn("ai tool call failed tool={} error={}", prepared.name, failure::class.simpleName)
        failure(prepared, unknownOutcomeCode(prepared.name), "Tool call failed.")
    }

    private fun unknownOutcomeCode(name: String) = if (isWrite(name)) OUTCOME_UNKNOWN else BACKEND_UNAVAILABLE

    private fun failure(call: ToolCall, code: String, message: String) = ToolResult(
        call.id,
        call.name,
        """{"code":"$code","message":"$message"}""",
        isError = true,
        code = code,
    )

    private companion object {
        val log = LoggerFactory.getLogger(CatalogAgentToolbox::class.java)
        const val OUTCOME_UNKNOWN = "OUTCOME_UNKNOWN"
        const val BACKEND_UNAVAILABLE = "BACKEND_UNAVAILABLE"

        /** Поля, которые задаёт сервер; присланные моделью значения отбрасываются. */
        val SERVER_FIELDS = setOf(
            "designSystem",
            "designSystemId",
            "projectId",
            "version",
            "versionId",
            "idempotencyKey",
            "expectedDraftId",
        )
    }
}
