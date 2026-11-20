package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Адресная цель с видом изменения для предметных ограничений инспектора. */
@Serializable
data class TokenTargetResponse(
    /** Предметный тип. */
    val entityType: String,
    /** Устойчивый ID. */
    val entityId: String,
    /** Редакция цели. */
    val expectedRevision: Long,
    /** Создание, изменение или удаление. */
    val operation: String,
)
