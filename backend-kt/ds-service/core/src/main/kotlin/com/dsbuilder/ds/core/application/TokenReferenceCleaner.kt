package com.dsbuilder.ds.core.application

import java.util.UUID

/** Предметный владелец ссылок отсоединяет удаляемые токены в текущей транзакции, сохраняя опубликованную историю. */
fun interface TokenReferenceCleaner {
    /** Очищает только действующие ссылки в указанной ДС. */
    suspend fun clear(designSystemId: UUID, tokenIds: Set<UUID>)
}
