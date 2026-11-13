package com.dsbuilder.ds.designsystems.application

import java.util.UUID

/** Адрес устойчивой сущности и редакция, которую пользователь собирается отменить. */
data class DraftAddressTarget(
    /** Зарегистрированный предметный тип. */
    val entityType: String,
    /** Устойчивый ID, не ID строки ревизии. */
    val entityId: UUID,
    /** Ожидаемая предметная редакция. */
    val expectedRevision: Long,
)
