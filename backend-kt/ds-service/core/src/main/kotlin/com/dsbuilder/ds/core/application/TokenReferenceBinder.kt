package com.dsbuilder.ds.core.application

import java.util.UUID

/**
 * Предметный владелец ссылок переводит текстовые ссылки на токен в ссылки по `token_id` в текущей транзакции:
 * после переименования токена такие ссылки идут за новым именем, а при откате переименования — за прежним.
 */
fun interface TokenReferenceBinder {
    /** Привязывает к токену [tokenId] текстовые ссылки [rowIds] (строки значений свойств) в указанной ДС. */
    suspend fun bind(designSystemId: UUID, tokenId: UUID, rowIds: Set<UUID>)
}
