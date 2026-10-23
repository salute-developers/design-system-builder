package com.dsbuilder.ds.themes.domain.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.JsonElement

/** Значение токена размеров одной платформы в её формате и признак своего значения. */
data class SizeWrittenValue(
    /** Платформа. */
    val platform: ThemeTokenPlatform,
    /** Значение в формате платформы. */
    val value: JsonElement,
    /** Своё значение платформы: не перестраивается из веба. */
    val overridden: Boolean,
)
