package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.sizetokens.SizeStoredValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenNaming
import java.util.UUID

/** Определение токена дизайн-системы и его значения в теме. */
data class StoredSizeToken(
    /** Идентификатор токена. */
    val id: UUID,
    /** Полное имя. */
    val name: String,
    /** Тип; `null` у определения без типа. */
    val type: ThemeTokenType?,
    /** Значения темы по платформам. */
    val values: Map<ThemeTokenPlatform, SizeStoredValue>,
) {
    /** Раздел токена или `null`, если тип или имя вне правил токенов размеров. */
    val kind: SizeTokenKind?
        get() = SizeTokenNaming.kindOf(type, name)
}
