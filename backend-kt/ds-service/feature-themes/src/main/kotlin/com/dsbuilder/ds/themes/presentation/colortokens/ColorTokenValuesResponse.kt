package com.dsbuilder.ds.themes.presentation.colortokens

import com.dsbuilder.ds.themes.application.colortokens.ColorTokenMutation
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import kotlinx.serialization.Serializable

/** Итог изменения значений цветового токена `{ editRevision, type }`. */
@Serializable
data class ColorTokenValuesResponse(
    /** Совместимое поле прежнего счётчика темы: сервер возвращает `0`, редакции — в `X-DS-Mutation-Metadata`. */
    val editRevision: Int,
    /** Тип семейства после изменения: `color` или `gradient`. */
    val type: String,
) {
    companion object {
        /** DTO из результата операции. */
        fun from(value: ColorTokenMutation<ThemeTokenType>) =
            ColorTokenValuesResponse(value.editRevision, value.value.wireValue)
    }
}
