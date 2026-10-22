package com.dsbuilder.ds.core.application

import java.util.UUID

/** Проверяет предметные зависимости результата отмены в той же транзакции до её фиксации. */
fun interface DraftChangeDependencyValidator {
    /** Возвращает false, если восстановленное состояние требует отсутствующую предметную сущность. */
    suspend fun valid(designSystemId: UUID, entityType: String, entityId: UUID): Boolean
}
