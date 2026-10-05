package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.json.jsonb
import org.postgresql.util.PGobject

internal object ThemeDesignSystemsTable : Table("design_systems") {
    val id = uuid("id")
    val projectId = text("project_id").nullable()
    override val primaryKey = PrimaryKey(id)
}

internal object TenantsTable : Table("tenants") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", ThemeDesignSystemsTable.id)
    val name = text("name").nullable()
    val description = text("description").nullable()
    val colorConfig = jsonb<JsonElement>("color_config", Json.Default)
    val editRevision = integer("edit_revision")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ThemeTokenValuesTable : Table("token_values") {
    val id = uuid("id")
    val tokenId = uuid("token_id").nullable()
    val tenantId = uuid("tenant_id").nullable()
    val paletteId = uuid("palette_id").nullable()
    val platform = postgresEnum(
        "platform",
        "platform",
        ThemeTokenPlatform::fromWire,
        ThemeTokenPlatform::wireValue,
    ).nullable()
    val mode = postgresEnum("mode", "mode", ThemeTokenMode::fromWire, ThemeTokenMode::wireValue).nullable()
    val value = jsonb<JsonElement>("value", Json.Default).nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object ThemeTokensTable : Table("tokens") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id").nullable()
    val name = text("name")
    val type = postgresEnum("type", "token_type", ThemeTokenType::fromWire, ThemeTokenType::wireValue).nullable()
    override val primaryKey = PrimaryKey(id)
}

internal object ThemePaletteTable : Table("palette") {
    val id = uuid("id")
    val type = postgresEnum("type", "palette_type", ThemePaletteType::fromWire, ThemePaletteType::wireValue)
    val shade = text("shade")
    val saturation = integer("saturation")
    val value = text("value")
    override val primaryKey = PrimaryKey(id)
}

private fun <T : Enum<T>> Table.postgresEnum(
    name: String,
    sqlType: String,
    fromWire: (String) -> T?,
    toWire: (T) -> String,
) = customEnumeration(
    name,
    sqlType,
    { value -> requireNotNull(fromWire(value.toString())) },
    { value ->
        PGobject().apply {
            type = sqlType
            this.value = toWire(value)
        }
    },
)
