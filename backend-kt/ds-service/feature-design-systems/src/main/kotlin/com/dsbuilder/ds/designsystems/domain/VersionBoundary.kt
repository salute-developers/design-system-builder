package com.dsbuilder.ds.designsystems.domain

/** Независимая временная граница состояния дизайн-системы. */
data class VersionBoundary(
    /** Идентификатор версии. */
    val id: DesignSystemVersionId,
    /** Дизайн-система, которой принадлежит версия. */
    val designSystemId: DesignSystemId,
    /** Монотонный номер временной границы внутри дизайн-системы. */
    val sequenceNumber: Long,
    /** Техническая редакция содержимого черновика. */
    val revision: Long,
    /** Состояние временной границы. */
    val status: DesignSystemVersionStatus,
) {
    init {
        require(sequenceNumber >= 0) { "sequenceNumber must not be negative" }
        require(revision >= 0) { "revision must not be negative" }
    }
}
