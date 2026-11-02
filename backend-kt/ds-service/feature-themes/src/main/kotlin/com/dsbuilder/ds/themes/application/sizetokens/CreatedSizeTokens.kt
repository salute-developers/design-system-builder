package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenView

/** Созданный токен: радиус, отступ или тень. */
data class CreatedSizeTokens(
    /** Раздел. */
    val kind: SizeTokenKind,
    /** Токены в формате чтения текущей темы. */
    val created: List<SizeTokenView>,
)
