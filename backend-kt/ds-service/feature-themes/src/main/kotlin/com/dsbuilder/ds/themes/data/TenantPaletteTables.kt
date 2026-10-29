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

internal object TenantPaletteGroupsTable : PaletteResolvedTable(
    "tenant_palette_groups",
    "tenant_palette_group_revisions",
    "group_id",
    listOf("id", "design_system_id", "tenant_id", "kind", "system_key", "created_at"),
    listOf("label", "position"),
) {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val tenantId = uuid("tenant_id")
    val kind = postgresEnum("kind", "palette_group_kind", PaletteGroupKind::fromWire, PaletteGroupKind::wireValue)
    val systemKey = text("system_key").nullable()
    val label = text("label")
    val position = integer("position")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

internal object TenantPaletteRampsTable : PaletteResolvedTable(
    "tenant_palette_ramps",
    "tenant_palette_ramp_revisions",
    "ramp_id",
    listOf("id", "design_system_id", "group_id", "slot_type", "slot_shade", "created_at"),
    listOf("source_type", "source_shade", "added", "origin", "anchor_step", "anchor_value"),
) {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
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

internal object TenantPaletteStepsTable : PaletteResolvedTable(
    "tenant_palette_steps",
    "tenant_palette_step_revisions",
    "step_id",
    listOf("id", "design_system_id", "ramp_id", "step"),
    listOf("value"),
) {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val rampId = uuid("ramp_id")
    val step = integer("step")
    val value = text("value")
    override val primaryKey = PrimaryKey(id)
}

internal object TenantPaletteTokenGroupsTable : PaletteResolvedTable(
    "tenant_palette_token_groups",
    "tenant_palette_token_group_revisions",
    "assignment_id",
    listOf("id", "design_system_id", "tenant_id", "token_id"),
    listOf("group_id"),
) {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val tenantId = uuid("tenant_id")
    val tokenId = uuid("token_id")
    val groupId = uuid("group_id")
    override val primaryKey = PrimaryKey(id)
}
