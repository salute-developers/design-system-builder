package com.dsbuilder.ds.themes.domain.colortokens

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.JsonElement

/** Действующее значение члена семейства в какой-либо теме и режиме для вычисления типа семейства. */
data class FamilyValue(
    /** Платформа значения. */
    val platform: ThemeTokenPlatform,
    /** JSON-значение или `null`, если значение задано только `palette_id`. */
    val value: JsonElement?,
)
