package com.dsbuilder.ai.chat.application

import com.dsbuilder.ai.chat.domain.ChatEvent
import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import com.dsbuilder.ai.chat.domain.ConfirmationReason
import com.dsbuilder.ai.chat.domain.LlmFailure
import com.dsbuilder.ai.chat.domain.LlmRequest
import com.dsbuilder.ai.chat.domain.LlmResponse
import com.dsbuilder.ai.chat.domain.ToolCall
import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ai.chat.domain.ToolSpec
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonObject
import java.time.Clock
import java.util.UUID
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.minutes
import kotlin.time.TimeSource

/**
 * Один ход агента: шаги модели и инструментов до текста, паузы на подтверждение, остановки или лимита.
 *
 * Выполняется в области подсистемы от имени участника проекта из POST. Каждое событие пишется через [TurnStore.append]
 * до того, как его увидят подписчики. Ход всегда завершается событиями `state` и `done`.
 */
class RunChatTurnUseCase internal constructor(
    private val llm: LlmClient,
    private val toolbox: AgentToolbox,
    private val signer: ConfirmationSigner,
    private val turns: TurnStore,
    private val limits: AgentLimits,
    private val refresher: ChatAccessRefresher? = null,
    private val clock: Clock = Clock.systemUTC(),
    private val newKey: () -> String = { UUID.randomUUID().toString() },
) {
    private val budget = HistoryBudget(limits.historyMaxChars, limits.toolResultMaxChars)

    /** Выполняет ход до конца; исключения не выходят наружу. */
    suspend fun run(command: ChatTurnCommand) {
        val turn = Turn(command)
        try {
            turn.execute()
        } catch (cancelled: CancellationException) {
            turn.error(ERROR_STOPPED, "Ход остановлен.")
            throw cancelled
        } catch (@Suppress("TooGenericExceptionCaught") failure: Exception) {
            turn.error(ERROR_INTERNAL, "Ход завершился внутренней ошибкой: ${failure::class.simpleName}.")
        } finally {
            withContext(NonCancellable) {
                turn.emit(ChatEvent.State(turn.finalHistory()))
                turn.emit(ChatEvent.Done)
                turns.complete(command.turnId)
                turn.log()
            }
        }
    }

    private inner class Turn(private val command: ChatTurnCommand) {
        private val started = TimeSource.Monotonic.markNow()
        private val interrupted = command.messages.any { it.role == ChatRole.INTERRUPTED }
        private var history = repairPending(command.messages, command.confirmed?.operation?.callId)
        private var writes = 0
        private var principal = command.principal
        private var access = command.access
        private var modelAnswered = false
        private var errorEmitted = false
        private var outcome = "done"
        private var steps = 0
        private var accessRevoked = false
        private val tools = mutableListOf<String>()

        suspend fun execute() {
            command.confirmed?.let { confirmed ->
                runConfirmed(confirmed)
                if (accessRevoked) return error(ERROR_ACCESS_REVOKED, "Доступ к проекту отозван.")
                if (turns.isStopRequested(command.turnId)) return error(ERROR_STOPPED, "Ход остановлен.")
            }
            repeat(limits.maxSteps) {
                if (!step()) return
            }
            error(ERROR_STEP_LIMIT, "Достигнут предел шагов хода.")
        }

        /** Один шаг модели; false — ход завершается. */
        private suspend fun step(): Boolean {
            val stop = stopReason()
            val specs = toolbox.specs(access)
            val reserved = systemPrompt().length + specs.sumOf { specChars(it) }
            val fitted = if (stop == null) budget.fit(history, reserved) else null
            if (fitted == null) {
                val (code, message) =
                    stop ?: (ERROR_CONTEXT_OVERFLOW to "История разговора не помещается в лимит модели.")
                error(code, message)
                return false
            }
            val response = requestModel(fitted, specs) ?: return false
            modelAnswered = true
            steps++
            return when (response) {
                is LlmResponse.Text -> {
                    history = history + ChatMessage(ChatRole.ASSISTANT, text = response.text)
                    emit(ChatEvent.Message(response.text))
                    false
                }
                is LlmResponse.ToolCalls -> runCalls(response.calls)
            }
        }

        /**
         * Запрашивает модель. Ожидание вместе с повторами ограничено оставшимся сроком хода и прерывается
         * остановкой; при сбое, остановке или истечении срока пишет ошибку и возвращает null.
         */
        private suspend fun requestModel(messages: List<ChatMessage>, specs: List<ToolSpec>): LlmResponse? {
            val remaining = limits.turnTimeout - started.elapsedNow()
            return try {
                withTimeout(remaining) { stoppable { llm.complete(LlmRequest(systemPrompt(), messages, specs)) } }
            } catch (timeout: TimeoutCancellationException) {
                error(ERROR_TURN_TIMEOUT, "Ход занял больше отведённого времени.")
                null
            } catch (stopped: TurnStopped) {
                error(ERROR_STOPPED, "Ход остановлен.")
                null
            } catch (failure: LlmFailure) {
                error(failure.code(), failure.message.orEmpty())
                null
            }
        }

        /** Выполняет [block], отменяя его, как только запрошена остановка хода. */
        private suspend fun <T> stoppable(block: suspend () -> T): T = coroutineScope {
            val work = async { block() }
            val watcher = launch {
                while (isActive && !turns.isStopRequested(command.turnId)) delay(STOP_POLL)
                work.cancel()
            }
            try {
                work.await()
            } catch (cancelled: CancellationException) {
                currentCoroutineContext().ensureActive()
                if (turns.isStopRequested(command.turnId)) throw TurnStopped()
                throw cancelled
            } finally {
                watcher.cancel()
            }
        }

        /** Актуализирует права перед вызовом инструмента; null — права действуют, иначе причина отказа. */
        private suspend fun refreshAccess(): AccessCheck? {
            val check = refresher?.refresh(command.principal) ?: return null
            if (check is AccessCheck.Current) {
                principal = check.principal
                access = check.access
                return null
            }
            return check
        }

        /** Выполняет подтверждённую операцию по данным токена; остановка действует после неё. */
        private suspend fun runConfirmed(confirmed: ConfirmedOperation) {
            val operation = confirmed.operation
            val visible = toolbox.visibleArguments(operation.arguments)
            val denied = if (confirmed.approved) refreshAccess() else null
            if (denied == AccessCheck.Revoked) {
                val result = agentError(operation.callId, operation.tool, CODE_NOT_ALLOWED, "Доступ к проекту отозван.")
                emitFinished(result)
                history = placeResult(history, ToolCall(operation.callId, operation.tool, visible), result)
                accessRevoked = true
                return
            }
            val result = if (denied == AccessCheck.Unavailable) {
                agentError(operation.callId, operation.tool, CODE_BACKEND_UNAVAILABLE, "Права не проверены.")
            } else if (!toolbox.isAllowed(operation.tool, access) && confirmed.approved) {
                agentError(operation.callId, operation.tool, CODE_NOT_ALLOWED, "Инструмент недоступен.")
            } else if (confirmed.approved) {
                emit(ChatEvent.ToolStarted(operation.callId, operation.tool, visible))
                val call = ToolCall(operation.callId, operation.tool, operation.arguments)
                val executed = executeTool(call, toolContext(call, operation.idempotencyKey, operation.draftId))
                if (toolbox.isWrite(operation.tool) && !executed.isError) writes++
                executed
            } else {
                agentError(operation.callId, operation.tool, CODE_USER_REJECTED, "Пользователь отклонил операцию.")
            }
            emitFinished(result)
            history = placeResult(history, ToolCall(operation.callId, operation.tool, visible), result)
        }

        /** Выполняет вызовы одного ответа модели; false — ход завершается. */
        private suspend fun runCalls(calls: List<ToolCall>): Boolean {
            val batch = CallBatch()
            for (call in calls) {
                if (!runCall(call, batch)) break
            }
            val shown = batch.executed.map { it.first } + listOfNotNull(batch.pending)
            if (shown.isNotEmpty()) {
                history = history + ChatMessage(ChatRole.ASSISTANT, toolCalls = shown) +
                    batch.executed.map { (_, result) -> ChatMessage(ChatRole.TOOL, toolResult = result) }
            }
            batch.finish?.let { (code, message) -> error(code, message) }
            return batch.finish == null && batch.pending == null
        }

        /** Обрабатывает один вызов ответа модели; false — остальные вызовы ответа не выполняются. */
        private suspend fun runCall(call: ToolCall, batch: CallBatch): Boolean {
            blocked(call, batch)?.let { return it }
            val rejected = rejection(call) ?: return runAllowed(call, batch)
            emitFinished(rejected.second)
            batch.executed += rejected
            return true
        }

        /**
         * Остановка, срок хода и актуальные права перед вызовом. null — вызов можно выполнять, иначе результат для
         * [runCall]: false — остальные вызовы ответа не выполняются.
         */
        private suspend fun blocked(call: ToolCall, batch: CallBatch): Boolean? {
            batch.finish = stopReason()
            if (batch.finish != null) return false
            return when (refreshAccess()) {
                AccessCheck.Revoked -> {
                    batch.finish = ERROR_ACCESS_REVOKED to "Доступ к проекту отозван."
                    false
                }
                AccessCheck.Unavailable -> {
                    val failed = agentError(call.id, call.name, CODE_BACKEND_UNAVAILABLE, "Права не проверены.")
                    emitFinished(failed)
                    batch.executed += call to failed
                    true
                }
                else -> null
            }
        }

        /** Отказ агента для вызова с неразобранными аргументами или недоступного инструмента. */
        private fun rejection(call: ToolCall): Pair<ToolCall, ToolResult>? = when {
            call.hasInvalidArguments -> call.copy(arguments = JsonObject(emptyMap())) to
                agentError(call.id, call.name, CODE_INVALID_ARGUMENTS, "Аргументы вызова не разобраны как JSON.")
            !toolbox.isAllowed(call.name, access) ->
                call to agentError(call.id, call.name, CODE_NOT_ALLOWED, "Инструмент недоступен.")
            toolbox.prepare(call) == null ->
                call to agentError(call.id, call.name, CODE_INVALID_ARGUMENTS, "Аргументы не соответствуют схеме.")
            else -> null
        }

        /** Выполняет разрешённый вызов либо останавливает ход на подтверждении. */
        private suspend fun runAllowed(call: ToolCall, batch: CallBatch): Boolean {
            val write = toolbox.isWrite(call.name)
            if (toolbox.isDestructive(call.name) || (write && writes >= limits.maxWrites)) {
                if (requestConfirmation(call, write)) {
                    batch.pending = call
                    return false
                }
                val failed = agentError(call.id, call.name, CODE_BACKEND_UNAVAILABLE, "Черновик DS не прочитан.")
                emitFinished(failed)
                batch.executed += call to failed
                return true
            }
            val prepared = requireNotNull(toolbox.prepare(call))
            emit(ChatEvent.ToolStarted(call.id, call.name, toolbox.visibleArguments(prepared.arguments)))
            val result = executeTool(prepared, toolContext(prepared, if (write) newKey() else null, null))
            if (write && !result.isError) writes++
            emitFinished(result)
            batch.executed += prepared to result
            return true
        }

        /** Ставит вызов на подтверждение; false — черновик не прочитан, и вызов получил ошибку. */
        private suspend fun requestConfirmation(call: ToolCall, write: Boolean): Boolean {
            val prepared = requireNotNull(toolbox.prepare(call))
            val draftId = toolbox.activeDraftId(principal, command.scope.designSystemId)
                ?: return false
            val key = newKey()
            val expiresAt = clock.instant().plusSeconds(CONFIRMATION_TTL_SECONDS)
            val token = signer.issue(
                PendingOperation(call.id, call.name, prepared.arguments, key, draftId, command.scope, expiresAt),
            )
            val reason = if (toolbox.isDestructive(call.name) || !write) {
                ConfirmationReason.DESTRUCTIVE
            } else {
                ConfirmationReason.WRITE_LIMIT
            }
            emit(
                ChatEvent.ConfirmationRequired(
                    call.id,
                    call.name,
                    toolbox.visibleArguments(prepared.arguments),
                    reason,
                    token,
                    expiresAt,
                ),
            )
            return true
        }

        private fun toolContext(call: ToolCall, key: String?, expectedDraftId: String?) = ChatToolContext(
            principal = principal,
            designSystemId = command.scope.designSystemId,
            correlationId = "${command.turnId}:${call.id}",
            idempotencyKey = key,
            expectedDraftId = expectedDraftId,
        )

        private suspend fun executeTool(prepared: ToolCall, context: ChatToolContext): ToolResult {
            tools += prepared.name
            return withContext(NonCancellable) { toolbox.execute(prepared, context) }
        }

        /** Одна строка на ход: без текстов сообщений, аргументов и заголовков. */
        fun log() {
            log.info(
                "ai turn finished project={} designSystem={} turn={} steps={} writes={} tools={} " +
                    "outcome={} durationMs={}",
                command.scope.projectId,
                command.scope.designSystemId,
                command.turnId,
                steps,
                writes,
                tools.joinToString(","),
                outcome,
                started.elapsedNow().inWholeMilliseconds,
            )
        }

        private fun stopReason(): Pair<String, String>? = when {
            turns.isStopRequested(command.turnId) -> ERROR_STOPPED to "Ход остановлен."
            started.elapsedNow() > limits.turnTimeout -> ERROR_TURN_TIMEOUT to "Ход занял больше отведённого времени."
            else -> null
        }

        private fun systemPrompt(): String = SystemPrompt.build(command.scope, interrupted, command.context)

        private fun emitFinished(result: ToolResult) = emit(
            ChatEvent.ToolFinished(
                result.callId,
                result.name,
                result.isError,
                result.code,
                result.backendCode,
                result.content.take(SUMMARY_CHARS),
            ),
        )

        fun emit(event: ChatEvent) {
            turns.append(command.turnId, event, event.toString().toByteArray().size.toLong())
        }

        fun error(code: String, message: String) {
            if (errorEmitted) return
            errorEmitted = true
            outcome = code
            emit(ChatEvent.Error(code, message))
        }

        /** Пометки о прерванном ходе убираются, только если модель уже получила требование перечитать данные. */
        fun finalHistory(): List<ChatMessage> =
            if (modelAnswered) history.filterNot { it.role == ChatRole.INTERRUPTED } else history
    }

    /** Состояние вызовов одного ответа модели. */
    private class CallBatch {
        val executed = mutableListOf<Pair<ToolCall, ToolResult>>()
        var pending: ToolCall? = null
        var finish: Pair<String, String>? = null
    }

    private fun agentError(callId: String, name: String, code: String, message: String) =
        ToolResult(callId, name, """{"code":"$code","message":"$message"}""", isError = true, code = code)

    /**
     * Добавляет результат `not_confirmed` вызовам без результата, кроме [confirmedCallId], сразу после их
     * сообщения ассистента: иначе API формата OpenAI отклонит вызов инструмента без ответа.
     */
    private fun repairPending(messages: List<ChatMessage>, confirmedCallId: String?): List<ChatMessage> =
        fixTrailingResults(messages, messages.mapNotNull { it.toolResult?.callId }.toSet(), confirmedCallId)

    /** Результаты, идущие сразу после сообщения ассистента, дополняются недостающими `not_confirmed`. */
    private fun fixTrailingResults(
        messages: List<ChatMessage>,
        answered: Set<String>,
        confirmedCallId: String?,
    ): List<ChatMessage> = buildList {
        var index = 0
        while (index < messages.size) {
            val message = messages[index]
            add(message)
            index++
            if (message.role != ChatRole.ASSISTANT || message.toolCalls.isEmpty()) continue
            while (index < messages.size && messages[index].role == ChatRole.TOOL) add(messages[index++])
            val present = mapNotNull { it.toolResult?.callId }.toSet()
            message.toolCalls
                .filter { it.id !in present && it.id !in answered && it.id != confirmedCallId }
                .forEach { call ->
                    val result = agentError(call.id, call.name, CODE_NOT_CONFIRMED, "Операция не подтверждена.")
                    add(ChatMessage(ChatRole.TOOL, toolResult = result))
                }
        }
    }

    /** Ставит результат подтверждённой операции сразу после её сообщения ассистента с аргументами из токена. */
    private fun placeResult(messages: List<ChatMessage>, call: ToolCall, result: ToolResult): List<ChatMessage> {
        val owner = messages.indexOfLast { message -> message.toolCalls.any { it.id == call.id } }
        if (owner < 0) {
            return messages + ChatMessage(ChatRole.ASSISTANT, toolCalls = listOf(call)) +
                ChatMessage(ChatRole.TOOL, toolResult = result)
        }
        val assistant = messages[owner].copy(
            toolCalls = messages[owner].toolCalls.map { if (it.id == call.id) call else it },
        )
        var insertAt = owner + 1
        while (insertAt < messages.size && messages[insertAt].role == ChatRole.TOOL) insertAt++
        return messages.take(owner) + assistant + messages.subList(owner + 1, insertAt) +
            ChatMessage(ChatRole.TOOL, toolResult = result) + messages.drop(insertAt)
    }

    private fun LlmFailure.code(): String = when (this) {
        is LlmFailure.RateLimited -> ERROR_RATE_LIMITED
        is LlmFailure.Unavailable, is LlmFailure.InvalidResponse -> ERROR_UNAVAILABLE
    }

    companion object {
        private val log = org.slf4j.LoggerFactory.getLogger(RunChatTurnUseCase::class.java)

        /** Код события `error`: провайдер модели недоступен. */
        const val ERROR_UNAVAILABLE = "llm_unavailable"

        /** Код события `error`: провайдер ограничил частоту запросов. */
        const val ERROR_RATE_LIMITED = "llm_rate_limited"

        /** Код события `error`: достигнут предел шагов хода. */
        const val ERROR_STEP_LIMIT = "step_limit_reached"

        /** Код события `error`: истёк таймаут хода. */
        const val ERROR_TURN_TIMEOUT = "turn_timeout"

        /** Код события `error`: доступ участника к проекту отозван во время хода. */
        const val ERROR_ACCESS_REVOKED = "access_revoked"

        /** Код события `error`: история не помещается в лимит модели. */
        const val ERROR_CONTEXT_OVERFLOW = "context_overflow"

        /** Код события `error`: ход остановлен. */
        const val ERROR_STOPPED = "stopped"

        /** Код события `error`: внутренняя ошибка. */
        const val ERROR_INTERNAL = "internal_error"

        /** Код ошибки агента: инструмент недоступен. */
        const val CODE_NOT_ALLOWED = "tool_not_allowed"

        /** Код ошибки агента: пользователь отклонил операцию. */
        const val CODE_USER_REJECTED = "user_rejected"

        /** Код ошибки агента: операция не подтверждена. */
        const val CODE_NOT_CONFIRMED = "not_confirmed"

        /** Код ошибки агента: аргументы вызова не разобраны. */
        const val CODE_INVALID_ARGUMENTS = "invalid_arguments"

        /** Код ошибки инструмента: зависимость недоступна или вызов чтения не уложился в срок. */
        const val CODE_BACKEND_UNAVAILABLE = "BACKEND_UNAVAILABLE"

        /** Код ошибки инструмента: исход записи неизвестен. */
        const val CODE_OUTCOME_UNKNOWN = "OUTCOME_UNKNOWN"

        private const val SUMMARY_CHARS = 500
        private val STOP_POLL = 200.milliseconds

        /** Размер описания инструмента в запросе к модели: имя, описание и схема. */
        private fun specChars(spec: ToolSpec): Int =
            spec.name.length + spec.description.length + spec.parameters.toString().length
        private val CONFIRMATION_TTL_SECONDS = 10.minutes.inWholeSeconds
    }
}

/** Остановка хода во время ожидания модели. */
private class TurnStopped : RuntimeException(null, null, false, false)
