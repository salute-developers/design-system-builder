package com.dsbuilder.ai.chat.application

import com.dsbuilder.ai.chat.domain.ChatScope
import com.dsbuilder.authorization.ProjectPrincipal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.security.MessageDigest
import java.util.Base64
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.EmptyCoroutineContext
import kotlin.time.Duration

/** Результат запуска хода. */
sealed interface StartResult {
    /**
     * Ход запущен или найден уже принятый.
     *
     * @property turnId идентификатор хода.
     */
    data class Accepted(val turnId: String) : StartResult

    /**
     * Запрос отклонён.
     *
     * @property rejection причина отказа.
     */
    data class Rejected(val rejection: ChatRejection) : StartResult
}

/**
 * Область ходов подсистемы: ходы живут в ней, а не в корутине HTTP-запроса.
 *
 * Приём новых ходов и запуск выполняются под одной блокировкой, поэтому ход, зарегистрированный во время
 * остановки, не остаётся без выполнения.
 */
class ChatTurnScope(context: CoroutineContext) {
    private val job = SupervisorJob()
    private val scope = CoroutineScope(context + job)
    private val lock = Any()
    private var accepting = true

    /** Запускает [block], если область принимает ходы; иначе null. */
    internal fun launch(context: CoroutineContext, block: suspend CoroutineScope.() -> Unit): Job? =
        synchronized(lock) {
            if (!accepting || !scope.isActive) return null
            // ATOMIC: даже отменённый до старта ход дойдёт до finally и освободит слот.
            scope.launch(context, CoroutineStart.ATOMIC, block)
        }

    /** Перестаёт принимать ходы, отменяет идущие и ждёт начатые вызовы инструментов не дольше [grace]. */
    suspend fun shutdown(grace: Duration) {
        synchronized(lock) { accepting = false }
        withTimeoutOrNull(grace) { job.cancelAndJoin() }
    }
}

/** Поиск принятого запроса, проверка токена для нового, регистрация и запуск хода до ответа клиенту. */
class StartChatTurnUseCase internal constructor(
    private val turns: TurnStore,
    private val ownership: DesignSystemOwnership,
    private val signer: ConfirmationSigner,
    private val runner: RunChatTurnUseCase,
    private val turnScope: ChatTurnScope,
) {
    /** Ход выполняется от имени [principal] из проверенного контекста; учётные данные пользователя не нужны. */
    @Suppress("ReturnCount", "CyclomaticComplexMethod")
    suspend fun start(
        request: ChatTurnRequest,
        chatScope: ChatScope,
        principal: ProjectPrincipal,
        access: ChatAccess,
    ): StartResult {
        val confirmation = request.confirmations.firstOrNull()
        val keys = TurnKeys(
            owner = TurnOwner(chatScope.userId, chatScope.projectId),
            designSystemId = chatScope.designSystemId,
            idempotencyKey = request.idempotencyKey,
            fingerprint = fingerprint(request),
            confirmationTokenHash = confirmation?.let { signer.hash(it.confirmationToken) },
        )
        when (val existing = turns.find(keys)) {
            is TurnLookup.Existing -> return StartResult.Accepted(existing.turnId)
            TurnLookup.KeyReused -> return rejected(CONFLICT, KEY_REUSED)
            TurnLookup.ConfirmationScopeMismatch -> return rejected(BAD_REQUEST, CONFIRMATION_INVALID)
            TurnLookup.NotFound -> Unit
        }
        when (ownership.check(principal, chatScope.designSystemId)) {
            OwnershipCheck.OWNED -> Unit
            OwnershipCheck.NOT_FOUND -> return rejected(NOT_FOUND, "design_system_not_found")
            OwnershipCheck.FORBIDDEN -> return rejected(FORBIDDEN, "design_system_forbidden")
            OwnershipCheck.UNAVAILABLE -> return rejected(UNAVAILABLE, "dependency_unavailable")
        }
        val confirmed = confirmation?.let {
            when (val check = signer.verify(it.confirmationToken, chatScope)) {
                is ConfirmationCheck.Valid -> ConfirmedOperation(check.operation, it.approved)
                ConfirmationCheck.Expired -> return rejected(GONE, "confirmation_expired")
                ConfirmationCheck.Invalid -> return rejected(BAD_REQUEST, CONFIRMATION_INVALID)
            }
        }
        val turnId = when (val registration = turns.register(keys, inputBytes(request))) {
            is TurnRegistration.Started -> registration.turnId
            is TurnRegistration.Existing -> return StartResult.Accepted(registration.turnId)
            is TurnRegistration.Busy -> return StartResult.Rejected(
                ChatRejection(
                    TOO_MANY_REQUESTS,
                    "ai_busy",
                    mapOf(
                        "activeTurnId" to registration.activeTurnId,
                        "projectId" to registration.projectId,
                        "designSystemId" to registration.designSystemId,
                    ),
                ),
            )
            TurnRegistration.KeyReused -> return rejected(CONFLICT, KEY_REUSED)
            TurnRegistration.ConfirmationScopeMismatch -> return rejected(BAD_REQUEST, CONFIRMATION_INVALID)
            TurnRegistration.Overloaded -> return rejected(UNAVAILABLE, "ai_overloaded")
        }
        val command =
            ChatTurnCommand(turnId, chatScope, principal, access, request.messages, confirmed, request.context)
        val job = turnScope.launch(EmptyCoroutineContext) { runner.run(command) }
        if (job == null) {
            turns.cancelRegistration(turnId)
            return rejected(UNAVAILABLE, "ai_unavailable")
        }
        return StartResult.Accepted(turnId)
    }

    private fun rejected(status: Int, code: String) = StartResult.Rejected(ChatRejection(status, code))

    private fun fingerprint(request: ChatTurnRequest): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(
                listOf(
                    request.designSystemId,
                    request.messages,
                    request.confirmations,
                    request.context,
                ).toString().toByteArray(),
            )
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
    }

    private fun inputBytes(request: ChatTurnRequest): Long =
        (request.messages.toString() + request.context.toString()).toByteArray().size.toLong()

    private companion object {
        const val BAD_REQUEST = 400
        const val FORBIDDEN = 403
        const val NOT_FOUND = 404
        const val CONFLICT = 409
        const val GONE = 410
        const val TOO_MANY_REQUESTS = 429
        const val UNAVAILABLE = 503
        const val KEY_REUSED = "IDEMPOTENCY_KEY_REUSED"
        const val CONFIRMATION_INVALID = "confirmation_invalid"
    }
}
