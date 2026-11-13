package com.dsbuilder.projects.feature.projects.data.local.db

import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

internal object ProjectsTable : Table("projects") {
    val id = varchar("id", 64)
    val name = varchar("name", 255)
    val description = text("description").nullable()
    val status = varchar("status", 32)
    val ownerUserId = varchar("owner_user_id", 128)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")

    override val primaryKey = PrimaryKey(id)
}

internal object ProjectMembersTable : Table("project_members") {
    val projectId = reference("project_id", ProjectsTable.id, onDelete = ReferenceOption.CASCADE)
    val userId = varchar("user_id", 128)
    val role = varchar("role", 32)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")

    override val primaryKey = PrimaryKey(projectId, userId)
}
