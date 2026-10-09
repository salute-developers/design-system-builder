package com.dsbuilder.ds.designsystems.data

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

internal object DesignSystemsTable : Table("design_systems") {
    val id = uuid("id")
    val name = text("name")
    val projectName = text("project_name")
    val projectId = text("project_id").nullable()
    val description = text("description").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}
