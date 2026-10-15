package com.dsbuilder.ds.designsystems.domain

import java.time.Instant

/** Неизменяемая опубликованная граница дизайн-системы. */
data class DesignSystemVersion(
    /** Идентификатор временной границы. */
    val id: DesignSystemVersionId,
    /** Идентификатор дизайн-системы. */
    val designSystemId: DesignSystemId,
    /** Независимый порядковый номер границы. */
    val sequenceNumber: Long,
    /** Итоговая техническая редакция опубликованного черновика. */
    val revision: Long,
    /** Продуктовый номер версии. */
    val version: String,
    /** Описание публикации. */
    val changelog: String,
    /** Время публикации. */
    val publishedAt: Instant,
)
