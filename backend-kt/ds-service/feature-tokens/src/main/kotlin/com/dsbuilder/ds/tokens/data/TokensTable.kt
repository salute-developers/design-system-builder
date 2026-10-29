package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.tokens.domain.TokenType
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

/** Exposed mapping of the existing tokens table. */
internal object TokensTable : Table("tokens") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", TokenDesignSystemsTable.id).nullable()
    val createdAt = timestamp("created_at").databaseGenerated()
    override val primaryKey = PrimaryKey(id)
}

internal object TokenRevisionsTable : Table("token_revisions") {
    val id = uuid("id").databaseGenerated()
    val tokenId = reference("token_id", TokensTable.id)
    val designSystemId = uuid("design_system_id")
    val designSystemVersionId = uuid("design_system_version_id")
    val versionSequenceNumber = long("version_sequence_number")
    val name = text("name")
    val type = postgresEnum("type", "token_type", TokenType::fromWire, TokenType::wireValue).nullable()
    val displayName = text("display_name").nullable()
    val description = text("description").nullable()
    val enabled = bool("enabled")
    val groupId = uuid("group_id").nullable()
    val position = integer("position").default(0)
    val deleted = bool("deleted")
    val updatedAt = timestamp("updated_at").databaseGenerated()
}
