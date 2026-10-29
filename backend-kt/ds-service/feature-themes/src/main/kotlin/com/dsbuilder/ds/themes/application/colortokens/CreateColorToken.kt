package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import java.util.UUID

/** Создание цветового токена: определения семейства с начальными значениями и необязательная группа палитры. */
data class CreateColorToken(
    /** Ожидаемая ревизия текущей темы. */
    val editRevision: Int,
    /** Семейство токена. */
    val family: ColorTokenFamily,
    /** Отображаемое имя. */
    val displayName: String?,
    /** Описание. */
    val description: String?,
    /** Группа палитры текущей темы или `null` — группа по умолчанию. */
    val paletteGroupId: String?,
    /** Полное имя члена семейства → его значения. */
    val members: Map<String, List<ColorTokenValue>>,
    /** Группа или подгруппа токенов; `null` — без группы. */
    val groupId: UUID? = null,
    /** Позиция в группе; `null` — в конец. */
    val position: Int? = null,
)
