package com.dsbuilder.ds.core.application

import java.util.UUID

/** Повторяет неизменяемый HTTP-результат команды создания, не создавая вторую сущность. */
class IdempotentCreateExecutor(private val requests: IdempotentRequestRepository) {
    /** Вызывается внутри той же транзакции, что и предметное создание. */
    @Suppress("ReturnCount")
    suspend fun <T> execute(
        context: DsRequestContext,
        key: String?,
        operation: String,
        requestBody: Any?,
        @Suppress("UNUSED_PARAMETER") find: suspend (UUID) -> T?,
        create: suspend () -> T?,
        id: (T) -> UUID,
        encodeResponse: (T) -> String = { value -> "\"${id(value)}\"" },
        validateCreate: suspend () -> DsFailure? = { null },
    ): DsResult<T> {
        if (key.isNullOrBlank()) {
            validateCreate()?.let { return DsResult.Failure(it) }
            return create()?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
        }
        if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
            return DsResult.Failure(DsFailure.InvalidRequest("idempotency_key_too_long"))
        }
        val hash = RequestHash.canonical(requestBody)
        return when (val lookup = requests.lookup(context.projectId, key, operation, hash)) {
            IdempotentRequestLookup.PayloadMismatch ->
                DsResult.Failure(DsFailure.Conflict("IDEMPOTENCY_KEY_REUSED"))
            is IdempotentRequestLookup.Replayed -> throw IdempotentReplayException(lookup.response)
            IdempotentRequestLookup.New -> {
                validateCreate()?.let { return DsResult.Failure(it) }
                val created = create() ?: return DsResult.Failure(DsFailure.NotFound)
                requests.save(
                    context.projectId,
                    key,
                    context.principal.actorId,
                    operation,
                    hash,
                    IdempotentResponse(
                        201,
                        context.idempotentResponseEncoder?.invoke(created) ?: encodeResponse(created),
                    ),
                )
                DsResult.Success(created)
            }
        }
    }
}

/** Максимальная длина ключа повторяемости публичного запроса. */
const val MAX_IDEMPOTENCY_KEY_LENGTH = 255
