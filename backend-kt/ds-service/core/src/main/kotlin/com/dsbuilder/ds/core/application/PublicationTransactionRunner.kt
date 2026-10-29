package com.dsbuilder.ds.core.application

import java.util.UUID

/** Начинает строгую транзакцию публикации только после получения исключительного барьера ДС. */
interface PublicationTransactionRunner {
    /** Проверяет владельца, ожидает барьер и выполняет [block] с новым снимком состояния. */
    suspend fun <T> required(
        context: DsRequestContext,
        designSystemId: UUID,
        block: suspend () -> DsResult<T>,
    ): DsResult<T>
}
