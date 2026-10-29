package com.dsbuilder.ds.core.application

import com.dsbuilder.ds.core.domain.ProjectId

/** Хранилище результатов повторяемых запросов в области проекта. */
interface IdempotentRequestRepository {
    /** Блокирует ключ и проверяет существующий результат для операции и хэша тела. */
    suspend fun lookup(
        projectId: ProjectId,
        key: String,
        operation: String,
        requestHash: String,
    ): IdempotentRequestLookup

    /** Сохраняет окончательный результат в той же транзакции, где выполнялась [lookup]. */
    suspend fun save(
        projectId: ProjectId,
        key: String,
        actorId: String,
        operation: String,
        requestHash: String,
        response: IdempotentResponse,
    )
}
