package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ValuePaletteReferences
import kotlinx.serialization.json.Json
import java.sql.ResultSet
import java.util.UUID

/** Снимок выбранного значения; равенство включает все поля повторной проверки под блокировками. */
internal data class LiteralValueSnapshot(
    val boundaryId: UUID,
    val sequenceNumber: Long,
    val entityType: String?,
    val entityId: UUID?,
    val revision: Long?,
    val tokenId: UUID?,
    val tenantId: UUID?,
    val platform: String?,
    val mode: String?,
    val currentBoundary: UUID?,
    val value: String?,
    val paletteId: UUID?,
    val deleted: Boolean?,
    val name: String?,
    val type: ThemeTokenType?,
    val tokenDeleted: Boolean?,
    val tenantDeleted: Boolean?,
    val previousId: UUID?,
    val previousDeleted: Boolean?,
    val previousValue: String?,
    val previousPaletteId: UUID?,
    val currentPayload: String?,
    val previousPayload: String?,
    val creationBaseline: Boolean,
) {
    fun matchesRevision(expected: Long): Boolean = entityType == "token-value" && revision == expected &&
        currentBoundary == boundaryId

    fun hasPublishedParents(): Boolean = previousId != null && previousDeleted == false &&
        tokenDeleted == false && tenantDeleted == false

    fun isRestorableLiteral(): Boolean = !creationBaseline && type != null && previousPaletteId == null &&
        currentPayload != previousPayload &&
        ValuePaletteReferences.find(previousValue?.let(Json::parseToJsonElement)).isEmpty()

    fun family(): ColorTokenFamily? = ColorTokenFamily.of(requireNotNull(type), requireNotNull(name))
}

internal fun literalValueSnapshot(row: ResultSet): LiteralValueSnapshot = LiteralValueSnapshot(
    boundaryId = requireNotNull(row.getObject("boundary_id", UUID::class.java)),
    sequenceNumber = row.getLong("sequence_number"),
    entityType = row.getString("entity_type"),
    entityId = row.getObject("entity_id", UUID::class.java),
    revision = row.getObject("revision", Long::class.javaObjectType),
    tokenId = row.getObject("token_id", UUID::class.java),
    tenantId = row.getObject("tenant_id", UUID::class.java),
    platform = row.getString("platform"),
    mode = row.getString("mode"),
    currentBoundary = row.getObject("current_boundary", UUID::class.java),
    value = row.getString("value"),
    paletteId = row.getObject("palette_id", UUID::class.java),
    deleted = row.getObject("deleted", Boolean::class.javaObjectType),
    name = row.getString("name"),
    type = ThemeTokenType.fromWire(row.getString("type")),
    tokenDeleted = row.getObject("token_deleted", Boolean::class.javaObjectType),
    tenantDeleted = row.getObject("tenant_deleted", Boolean::class.javaObjectType),
    previousId = row.getObject("previous_exists", UUID::class.java),
    previousDeleted = row.getObject("previous_deleted", Boolean::class.javaObjectType),
    previousValue = row.getString("previous_value"),
    previousPaletteId = row.getObject("previous_palette_id", UUID::class.java),
    currentPayload = row.getString("current_payload"),
    previousPayload = row.getString("previous_payload"),
    creationBaseline = row.getBoolean("creation_baseline"),
)
