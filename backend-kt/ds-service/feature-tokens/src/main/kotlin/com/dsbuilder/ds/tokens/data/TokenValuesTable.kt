package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.tokens.domain.TokenMode
import com.dsbuilder.ds.tokens.domain.TokenPlatform
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.json.jsonb

/** Exposed mapping of the existing token_values table. */
internal object TokenValuesTable : Table("token_values") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val tokenId = reference("token_id", TokensTable.id)
    val tenantId = uuid("tenant_id")
    val platform = postgresEnum("platform", "platform", TokenPlatform::fromWire, TokenPlatform::wireValue).nullable()
    val mode = postgresEnum("mode", "mode", TokenMode::fromWire, TokenMode::wireValue).nullable()
    val createdAt = timestamp("created_at")
    override val primaryKey = PrimaryKey(id)
}

internal object TokenValueRevisionsTable : Table("token_value_revisions") {
    val id = uuid("id")
    val tokenValueId = reference("token_value_id", TokenValuesTable.id)
    val designSystemId = uuid("design_system_id")
    val designSystemVersionId = uuid("design_system_version_id")
    val versionSequenceNumber = long("version_sequence_number")
    val paletteId = uuid("palette_id").nullable()
    val value = jsonb<JsonElement>("value", Json.Default).nullable()
    val overridden = bool("overridden").default(false)
    val deleted = bool("deleted")
    val updatedAt = timestamp("updated_at")
}

internal object TokenValueCreationBaselinesTable : Table("token_value_creation_baselines") {
    val designSystemVersionId = uuid("design_system_version_id")
    val tokenValueId = reference("token_value_id", TokenValuesTable.id)
    val designSystemId = uuid("design_system_id")
    val paletteId = uuid("palette_id").nullable()
    val value = jsonb<JsonElement>("value", Json.Default).nullable()
    val overridden = bool("overridden").default(false)
    override val primaryKey = PrimaryKey(designSystemVersionId, tokenValueId)
}
