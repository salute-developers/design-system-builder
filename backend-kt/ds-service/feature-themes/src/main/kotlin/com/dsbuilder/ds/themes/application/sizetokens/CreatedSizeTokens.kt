package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenView

/** Созданные токены: радиус, отступ или четыре варианта размера тени. */
data class CreatedSizeTokens(
    /** Раздел. */
    val kind: SizeTokenKind,
    /** Токены в формате чтения текущей темы. */
    val created: List<SizeTokenView>,
)
