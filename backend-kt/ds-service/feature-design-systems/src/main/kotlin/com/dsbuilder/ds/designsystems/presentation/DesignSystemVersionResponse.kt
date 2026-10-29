package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion
import kotlinx.serialization.Serializable

/** Внешнее представление опубликованной границы новой модели. */
@Serializable
data class DesignSystemVersionResponse(
    /** Идентификатор публикации. */
    val id: String,
    /** Идентификатор дизайн-системы. */
    val designSystemId: String,
    /** Порядковый номер временной границы. */
    val sequenceNumber: Long,
    /** Итоговая техническая редакция. */
    val revision: Long,
    /** Продуктовый номер версии. */
    val version: String,
    /** Описание публикации. */
    val changelog: String,
    /** Время публикации. */
    val publishedAt: String,
) {
    companion object {
        /** Создаёт внешний ответ из предметной публикации. */
        fun from(value: DesignSystemVersion) = DesignSystemVersionResponse(
            value.id.value.toString(),
            value.designSystemId.value.toString(),
            value.sequenceNumber,
            value.revision,
            value.version,
            value.changelog,
            value.publishedAt.toString(),
        )
    }
}
