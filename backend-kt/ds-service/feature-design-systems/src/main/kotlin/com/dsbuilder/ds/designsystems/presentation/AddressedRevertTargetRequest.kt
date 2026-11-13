package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Устойчивая сущность и ожидаемая предметная редакция. */
@Serializable
data class AddressedRevertTargetRequest(
    /** Зарегистрированный тип. */
    val entityType: String,
    /** Устойчивый предметный ID. */
    val entityId: String,
    /** Предметная редакция из выбранного снимка. */
    val expectedRevision: Long,
)
