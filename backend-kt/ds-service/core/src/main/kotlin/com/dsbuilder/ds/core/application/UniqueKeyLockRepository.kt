package com.dsbuilder.ds.core.application

import java.util.UUID

/** Транзакционная блокировка нормализованного предметного ключа уникальности. */
interface UniqueKeyLockRepository {
    /** Последовательно обрабатывает конкурирующие записи одного ключа в границах дизайн-системы. */
    suspend fun lock(designSystemId: UUID, entityType: String, normalizedKey: String)
}
