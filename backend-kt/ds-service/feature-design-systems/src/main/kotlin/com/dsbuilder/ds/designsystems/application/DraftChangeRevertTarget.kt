package com.dsbuilder.ds.designsystems.application

import java.util.UUID

/** Запись пакетного отката: изменение журнала и его `editRevision` из снимка журнала, который видел клиент. */
data class DraftChangeRevertTarget(
    /** Устойчивый идентификатор изменения. */
    val changeId: UUID,
    /** Техническая редакция записи в снимке журнала клиента. */
    val expectedRevision: Long,
)
