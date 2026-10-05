package com.dsbuilder.ds.tokens.data

import org.jetbrains.exposed.v1.core.Table

/** Minimal design-system projection used for ownership joins. */
internal object TokenDesignSystemsTable : Table("design_systems") {
    val id = uuid("id")
    val projectId = text("project_id").nullable()
    override val primaryKey = PrimaryKey(id)
}

/** Minimal tenant projection used to keep token values inside one design system. */
internal object TokenTenantsTable : Table("tenants") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", TokenDesignSystemsTable.id)
    override val primaryKey = PrimaryKey(id)
}
