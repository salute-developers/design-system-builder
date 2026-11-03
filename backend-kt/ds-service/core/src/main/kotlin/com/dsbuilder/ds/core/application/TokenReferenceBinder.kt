package com.dsbuilder.ds.core.application

import java.util.UUID

/**
 * Предметный владелец ссылок переводит текстовые ссылки на токен в ссылки по `token_id` в текущей транзакции:
 * после переименования токена такие ссылки идут за новым именем, а при откате переименования — за прежним.
 */
interface TokenReferenceBinder {
    /** Привязывает к токену [tokenId] текстовые ссылки [rowIds] (строки значений свойств) в указанной ДС. */
    suspend fun bind(designSystemId: UUID, tokenId: UUID, rowIds: Set<UUID>)

    /**
     * Делает пустыми текстовые ссылки [rowIds] на удаляемый токен: у вариаций и инвариантов значение становится
     * `null`, у комбинаций стилей — пустой строкой (значение комбинации обязательно). Ссылки по `token_id` не
     * меняются: их очищает [TokenReferenceCleaner].
     */
    suspend fun detach(designSystemId: UUID, rowIds: Set<UUID>)
}
