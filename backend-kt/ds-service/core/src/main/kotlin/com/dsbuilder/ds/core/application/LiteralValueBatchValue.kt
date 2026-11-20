package com.dsbuilder.ds.core.application

import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Предметные условия восстановления одного значения, доступные всем участникам пакетной проверки. */
data class LiteralValueBatchValue(
    /** Предметный тип выбранного адреса. */
    val entityType: String,
    /** Устойчивый идентификатор значения. */
    val entityId: UUID,
    /** Определение, которому принадлежит значение. */
    val tokenId: UUID,
    /** Тема значения. */
    val tenantId: UUID,
    /** Тип определения на выбранной границе. */
    val tokenType: String,
    /** Определение, тема и предыдущая редакция доступны на проверенной границе. */
    val parentsVisible: Boolean,
    /** Значение относится к основе создания темы. */
    val creationBaseline: Boolean,
    /** Ссылка прежней редакции на всю ступень палитры. */
    val previousPaletteId: UUID?,
    /** Содержимое прежней редакции для проверки вложенных ссылок. */
    val previousValue: JsonElement?,
)
