package com.dsbuilder.ds.core.domain

import java.util.UUID

/** Активная временная граница, в которой выполняется предметная запись. */
data class DraftBoundaryRef(
    /** Идентификатор активного черновика. */
    val versionId: UUID,
    /** Идентификатор дизайн-системы. */
    val designSystemId: UUID,
    /** Порядковый номер временной границы. */
    val sequenceNumber: Long,
)
