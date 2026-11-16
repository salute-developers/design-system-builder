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
