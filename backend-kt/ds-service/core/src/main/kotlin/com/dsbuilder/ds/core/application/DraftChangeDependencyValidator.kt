package com.dsbuilder.ds.core.application

import java.util.UUID

/** Проверяет предметные зависимости результата отмены в той же транзакции до её фиксации. */
fun interface DraftChangeDependencyValidator {
    /** Возвращает false, если восстановленное состояние требует отсутствующую предметную сущность. */
    suspend fun valid(designSystemId: UUID, entityType: String, entityId: UUID): Boolean

    /**
     * Позиция первой сущности из [entities] (тип и идентификатор), восстановленное состояние которой недопустимо,
     * или `null`. Пакетный откат проверяет итог один раз; проверка может переиспользовать общие чтения пакета.
     */
    suspend fun firstInvalid(designSystemId: UUID, entities: List<Pair<String, UUID>>): Int? =
        entities.indexOfFirst { (type, id) -> !valid(designSystemId, type, id) }.takeIf { it >= 0 }
}
