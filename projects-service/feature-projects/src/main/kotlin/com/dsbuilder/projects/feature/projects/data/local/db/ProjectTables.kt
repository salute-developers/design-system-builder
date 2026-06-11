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

internal object ProjectAccessKeysTable : Table("project_access_keys") {
    val id = varchar("id", 64)
    val projectId = reference("project_id", ProjectsTable.id, onDelete = ReferenceOption.CASCADE)
    val name = varchar("name", 255)
    val scopes = text("scopes")
    val secretHash = text("secret_hash")
    val status = varchar("status", 32)
    val createdByUserId = varchar("created_by_user_id", 128)
    val expiresAt = timestamp("expires_at").nullable()
    val revokedAt = timestamp("revoked_at").nullable()
    val lastUsedAt = timestamp("last_used_at").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")

    override val primaryKey = PrimaryKey(id)
}
