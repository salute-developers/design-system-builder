package com.dsbuilder.ds.themes.domain

import java.time.Instant
import java.util.UUID

/** Theme entity whose external resource name remains `tenant`. */
data class Tenant(
    /** Id carried by this contract. */
    val id: UUID,
    /** Design system id carried by this contract. */
    val designSystemId: UUID,
    /** Name carried by this contract. */
    val name: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Color configuration carried by this contract. */
    val colorConfiguration: ColorConfiguration,
    /** Наибольшая редакция значений токенов темы в выбранной границе версии. */
    val editRevision: Int,
    /** Краткое цветовое представление темы. */
    val preview: ThemePreview,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
)
