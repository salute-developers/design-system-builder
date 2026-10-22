package com.dsbuilder.ds.core.application

import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Значение токена, которое общий маршрут чтения `GET /api/ds/token-values` отдаёт потребителю. */
data class TokenValueRead(
    /** Идентификатор значения. */
    val id: UUID,
    /** Токен значения. */
    val tokenId: UUID?,
    /** Тема значения. */
    val tenantId: UUID?,
    /** Платформа в wire-форме: `web`, `ios` или `android`. */
    val platform: String?,
    /** Ссылка `palette_id` на всё значение. */
    val paletteId: UUID?,
    /** Значение в форме для чтения. */
    val value: JsonElement?,
    /** Исходная ссылка на палитру, если [value] целиком вычислен по палитре темы. */
    val paletteRef: String? = null,
    /** Хранимое значение, если [value] отдаётся в другой форме и не задан целиком ссылкой [paletteRef]. */
    val sourceValue: JsonElement? = null,
)
