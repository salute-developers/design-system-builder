package com.dsbuilder.ds.themes.application.typography

import java.util.UUID

/** Тема на выбранной временной границе для операций над стилями. */
data class TypographyTenant(
    /** Дизайн-система темы. */
    val designSystemId: UUID,
)
