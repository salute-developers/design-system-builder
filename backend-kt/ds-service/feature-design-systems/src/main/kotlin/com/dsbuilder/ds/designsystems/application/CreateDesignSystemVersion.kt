package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId

/** Проверенная команда публикации активного черновика. */
data class CreateDesignSystemVersion(
    /** Публикуемая дизайн-система. */
    val designSystemId: DesignSystemId,
    /** Ожидаемый активный черновик. */
    val draftId: DesignSystemVersionId,
    /** Ожидаемая редакция черновика. */
    val draftRevision: Long,
    /** Продуктовый номер версии. */
    val version: String,
    /** Описание публикации. */
    val changelog: String,
)
