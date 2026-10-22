package com.dsbuilder.ds.core.application

import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Итоговое значение токена, которое общий маршрут собирается записать. */
data class TokenValueWrite(
    /** Токен значения. */
    val tokenId: UUID,
    /** Тема значения. */
    val tenantId: UUID,
    /** Платформа в wire-форме: `web`, `ios` или `android`. */
    val platform: String,
    /** Значение задано ссылкой `palette_id` на общую палитру. */
    val hasPaletteId: Boolean,
    /** Значение после записи. */
    val value: JsonElement?,
)
