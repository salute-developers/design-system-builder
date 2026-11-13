package com.dsbuilder.ds.core.application

import java.util.UUID

/**
 * Уже разрешённая граница компактного чтения журнала.
 * @property designSystemId Владелец всех выбираемых сущностей.
 * @property boundaryId Текущая граница, для которой применяются политики.
 * @property sequenceNumber Номер текущей границы включительно.
 * @property previousSequenceNumber Предыдущая граница сравнения.
 * @property tenantId Необязательное ограничение выбранной темой.
 */
data class JournalProjectionScope(
    val designSystemId: UUID,
    val boundaryId: UUID,
    val sequenceNumber: Long,
    val previousSequenceNumber: Long,
    val tenantId: UUID?,
)

/** Явное согласие политики на доказанное предметное исключение до получения подробностей. */
interface JournalCandidateExclusionPolicy {
    /** Поддерживает ли политика правило с устойчивым предметным идентификатором [exclusion]. */
    fun permits(exclusion: String): Boolean
}

/** Явная гарантия эквивалентности describeEntities и порционного visit для одних идентификаторов. */
interface JournalProjectionHandler

/** Узкий отбор кандидатов; несовместимые политики и обработчики сохраняют прежний обход. */
interface JournalCandidateProjection {
    /** Тип сущности, подробности которой получит существующий обработчик. */
    val entityType: String

    /** Типы с изменениями, необходимые для применения проекции. */
    val requiredChangedTypes: Set<String>

    /** Разрешают ли все активные политики раннее исключение кандидатов. */
    fun supports(policies: List<DraftChangePolicy>): Boolean

    /** Передаёт ограниченные порции кандидатов в текущей транзакции без изменения данных. */
    fun visit(scope: JournalProjectionScope, consume: (List<UUID>) -> Unit)
}
