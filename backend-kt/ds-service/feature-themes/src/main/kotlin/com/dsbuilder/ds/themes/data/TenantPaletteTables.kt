package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.palette.PaletteGroupKind
import com.dsbuilder.ds.themes.domain.palette.PaletteRampOrigin
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

internal object TenantPaletteTemplateTable : Table("tenant_palette_template") {
    val tenantId = uuid("tenant_id")
    val type = postgresEnum("type", "palette_type", ThemePaletteType::fromWire, ThemePaletteType::wireValue)
    val shade = text("shade")
    val step = integer("step")
    val value = text("value")
    override val primaryKey = PrimaryKey(tenantId, type, shade, step)
}

internal object TenantPaletteGroupsTable : Table("tenant_palette_groups") {
    val id = uuid("id")
    val tenantId = uuid("tenant_id")
    val kind = postgresEnum("kind", "palette_group_kind", PaletteGroupKind::fromWire, PaletteGroupKind::wireValue)
    val systemKey = text("system_key").nullable()
    val label = text("label")
    val position = integer("position")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object TenantPaletteRampsTable : Table("tenant_palette_ramps") {
    val id = uuid("id")
    val groupId = uuid("group_id")
    val slotType = postgresEnum("slot_type", "palette_type", ThemePaletteType::fromWire, ThemePaletteType::wireValue)
    val slotShade = text("slot_shade")
    val sourceType =
        postgresEnum("source_type", "palette_type", ThemePaletteType::fromWire, ThemePaletteType::wireValue)
    val sourceShade = text("source_shade")
    val added = bool("added")
    val origin =
        postgresEnum("origin", "palette_ramp_origin", PaletteRampOrigin::fromWire, PaletteRampOrigin::wireValue)
    val anchorStep = integer("anchor_step").nullable()
    val anchorValue = text("anchor_value").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object TenantPaletteStepsTable : Table("tenant_palette_steps") {
    val rampId = uuid("ramp_id")
    val step = integer("step")
    val value = text("value")
    override val primaryKey = PrimaryKey(rampId, step)
}

internal object TenantPaletteTokenGroupsTable : Table("tenant_palette_token_groups") {
    val tenantId = uuid("tenant_id")
    val tokenId = uuid("token_id")
    val groupId = uuid("group_id")
    override val primaryKey = PrimaryKey(tenantId, tokenId)
}
