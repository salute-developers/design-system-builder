package com.dsbuilder.ds.core.application

import java.util.UUID

/**
 * Явная возможность ограниченного обхода темы. Обёртка DraftChangeHandler не наследует её через by delegate:
 * если она фильтрует visit, общий обход сохраняет этот фильтр. Для оптимизации обёртка должна явно реализовать
 * данный контракт и применить те же предметные фильтры к visitTenant.
 */
interface TenantScopedDraftChangeHandler {
    /** Обрабатывает порции отличий только выбранной темы с сохранением предметных фильтров обработчика. */
    fun visitTenant(
        designSystemId: UUID,
        sequenceNumber: Long,
        previousSequenceNumber: Long,
        tenantId: UUID,
        consume: (List<DraftSubjectChange>) -> Unit,
    )
}

/** Выбирает явную оптимизацию темы либо visit фактической обёртки, сохраняя её фильтры. */
fun DraftChangeHandler.visitTenant(
    designSystemId: UUID,
    sequenceNumber: Long,
    previousSequenceNumber: Long,
    tenantId: UUID,
    consume: (List<DraftSubjectChange>) -> Unit,
) {
    if (this is TenantScopedDraftChangeHandler) {
        visitTenant(designSystemId, sequenceNumber, previousSequenceNumber, tenantId, consume)
    } else {
        visit(designSystemId, sequenceNumber, previousSequenceNumber, consume)
    }
}
