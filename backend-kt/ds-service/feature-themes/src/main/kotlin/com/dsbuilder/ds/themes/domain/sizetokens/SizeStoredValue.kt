package com.dsbuilder.ds.themes.domain.sizetokens

import kotlinx.serialization.json.JsonElement

/** Записанное значение токена размеров одной платформы. */
data class SizeStoredValue(
    /** Значение в формате платформы. */
    val value: JsonElement,
    /** Своё значение платформы (`token_value_revisions.overridden`). */
    val overridden: Boolean,
)
