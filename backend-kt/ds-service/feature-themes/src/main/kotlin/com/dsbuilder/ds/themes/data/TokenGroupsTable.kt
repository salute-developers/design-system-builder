package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.javatime.timestamp

internal object TokenGroupsTable : Table("token_groups") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val kind = postgresEnum("kind", "token_group_kind", TokenGroupKind::fromWire, TokenGroupKind::wireValue)
    val parentId = uuid("parent_id").nullable()
    val code = text("code").nullable()
    val label = text("label")
    val position = integer("position")
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}
