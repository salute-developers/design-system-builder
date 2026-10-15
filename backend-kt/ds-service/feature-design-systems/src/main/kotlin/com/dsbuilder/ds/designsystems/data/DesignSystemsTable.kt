package com.dsbuilder.ds.designsystems.data

import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

internal object DesignSystemsTable : Table("design_systems") {
    val id = uuid("id")
    val projectName = text("project_name")
    val projectId = text("project_id").nullable()
    val createdAt = timestamp("created_at")
    override val primaryKey = PrimaryKey(id)
}
