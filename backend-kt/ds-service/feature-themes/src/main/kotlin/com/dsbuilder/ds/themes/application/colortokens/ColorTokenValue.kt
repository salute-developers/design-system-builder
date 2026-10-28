package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Значение одного определения цветового токена для платформы и режима. */
data class ColorTokenValue(
    /** Платформа. */
    val platform: ThemeTokenPlatform,
    /** Режим. */
    val mode: ThemeTokenMode,
    /** Ссылка на запись общей палитры или `null`. */
    val paletteId: UUID?,
    /** JSON-значение. */
    val value: JsonElement,
    /** Базовая предметная редакция конкретной пары платформа/режим; null использует заголовок запроса. */
    val baseRevision: Long? = null,
    /** Своё значение платформы iOS или Android, а не построенное клиентом из web; у web всегда `false`. */
    val overridden: Boolean = false,
)
