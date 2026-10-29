package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.tokens.domain.PaletteType
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

/** Exposed mapping of the existing global palette table. */
internal object PaletteTable : Table("palette") {
    val id = uuid("id")
    val type = postgresEnum("type", "palette_type", PaletteType::fromWire, PaletteType::wireValue)
    val shade = text("shade")
    val saturation = integer("saturation")
    val value = text("value")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}
