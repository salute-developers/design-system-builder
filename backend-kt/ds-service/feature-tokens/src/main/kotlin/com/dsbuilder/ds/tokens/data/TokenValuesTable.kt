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
    val tokenId = reference("token_id", TokensTable.id).nullable()
    val tenantId = uuid("tenant_id").nullable()
    val paletteId = uuid("palette_id").nullable()
    val platform = postgresEnum("platform", "platform", TokenPlatform::fromWire, TokenPlatform::wireValue).nullable()
    val mode = postgresEnum("mode", "mode", TokenMode::fromWire, TokenMode::wireValue).nullable()
    val value = jsonb<JsonElement>("value", Json.Default).nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}
