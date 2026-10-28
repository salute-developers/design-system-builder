package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.ThemeTokenType

/** Тип семейства цветового токена по действующим значениям всех членов во всех темах. */
object ColorTokenFamilyType {
    /** `gradient`, если хотя бы одно значение — градиент, иначе `color`. */
    fun of(values: Collection<FamilyValue>): ThemeTokenType =
        if (values.any { ColorValueShape.kind(it.platform, it.value) == ColorValueKind.GRADIENT }) {
            ThemeTokenType.GRADIENT
        } else {
            ThemeTokenType.COLOR
        }
}
