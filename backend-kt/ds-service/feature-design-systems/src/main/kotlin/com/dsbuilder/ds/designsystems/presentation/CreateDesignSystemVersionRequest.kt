package com.dsbuilder.ds.designsystems.presentation

import kotlinx.serialization.Serializable

/** Команда публикации, содержащая только клиентские поля. */
@Serializable
data class CreateDesignSystemVersionRequest(
    /** Идентификатор дизайн-системы. */
    val designSystemId: String,
    /** Идентификатор ожидаемого активного черновика. */
    val draftId: String,
    /** Ожидаемая техническая редакция черновика. */
    val draftRevision: Long,
    /** Продуктовый номер публикации. */
    val version: String,
    /** Описание публикации. */
    val changelog: String,
)
