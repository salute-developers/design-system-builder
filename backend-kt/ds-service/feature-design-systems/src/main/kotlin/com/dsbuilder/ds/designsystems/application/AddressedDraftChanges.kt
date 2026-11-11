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

/** Цель сброса инспектора, включая удалённые значения и определения. */
data class DraftTokenTarget(
    /** Адрес и ожидаемая редакция. */
    val target: DraftAddressTarget,
    /** Создание, изменение или удаление. */
    val operation: String,
)

/** Страница целей ограниченной области токенов одной темы. */
data class DraftTokenTargetPage(
    /** Черновик, которому принадлежат цели. */
    val draftId: UUID,
    /** Отпечаток только выбранной области. */
    val scopeRevision: String,
    /** Цели этой страницы. */
    val targets: List<DraftTokenTarget>,
    /** Следующая страница той же области. */
    val nextCursor: String?,
)
