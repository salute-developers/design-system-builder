package com.dsbuilder.ds.themes.data

import kotlinx.serialization.json.JsonElement
import java.util.UUID

/**
 * Предметное значение редакции без технических метаданных границы. [overridden] — признак своего значения платформы:
 * пакетная запись переносит его из прежней редакции, чтобы переписывание ссылок его не сбрасывало.
 */
internal data class ThemeValuePayload(val paletteId: UUID?, val value: JsonElement?, val overridden: Boolean = false)
