package com.dsbuilder.ds.themes.data

import kotlinx.serialization.json.JsonElement
import java.util.UUID

/**
 * Предметное значение редакции без технических метаданных границы.
 *
 * @property overridden признак своего значения платформы (путь `/overridden`); при пакетной записи сохраняется как есть.
 */
internal data class ThemeValuePayload(val paletteId: UUID?, val value: JsonElement?, val overridden: Boolean = false)
