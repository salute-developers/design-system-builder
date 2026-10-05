package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.tokens.domain.TokenType
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

/** Exposed mapping of the existing tokens table. */
internal object TokensTable : Table("tokens") {
    val id = uuid("id")
    val designSystemId = reference("design_system_id", TokenDesignSystemsTable.id).nullable()
    val name = text("name")
    val type = postgresEnum("type", "token_type", TokenType::fromWire, TokenType::wireValue).nullable()
    val displayName = text("display_name").nullable()
    val description = text("description").nullable()
    val enabled = bool("enabled").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}
