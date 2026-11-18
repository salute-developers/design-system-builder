package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

/** Журнал загрузок каталога иконок. */
internal object IconCatalogLoadsTable : Table("icon_catalog_loads") {
    val loadId = text("load_id")
    val packageName = text("package_name")
    val packageVersion = text("package_version")
    val iconCount = integer("icon_count")
    val loadedBy = text("loaded_by")
    val loadedAt = timestamp("loaded_at")
    val active = bool("active")
    override val primaryKey = PrimaryKey(loadId)
}

/** Текущий каталог иконок. */
internal object IconsTable : Table("icons") {
    val name = text("name")
    val legacyKey = text("legacy_key")
    val style = text("style")
    val category = text("category").nullable()
    val aliases = array<String>("aliases")
    val sizes = array<Int>("sizes")
    val contentHash = text("content_hash")
    override val primaryKey = PrimaryKey(name)
}
