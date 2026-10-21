package com.dsbuilder.ds.themes.data

import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Предметное значение редакции без технических метаданных границы. */
internal data class ThemeValuePayload(val paletteId: UUID?, val value: JsonElement?)
