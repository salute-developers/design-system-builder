package com.dsbuilder.ds.designsystems.application

/** Цель сброса инспектора, включая удалённые значения и определения. */
data class DraftTokenTarget(
    /** Адрес и ожидаемая редакция. */
    val target: DraftAddressTarget,
    /** Создание, изменение или удаление. */
    val operation: String,
)
