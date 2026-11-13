package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.ModelReadItems
import com.dsbuilder.ds.core.application.ModelReadPage
import com.dsbuilder.ds.core.application.ModelReadQuery
import com.dsbuilder.ds.core.data.InvalidModelReadQueryException
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import org.jetbrains.exposed.v1.core.IntegerColumnType
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.ResultSet
import java.util.UUID

/** Читает только `limit + 1` видимых групп в порядке двухуровневого дерева. */
internal fun sqlPageTokenGroups(
    designSystemId: UUID,
    kind: TokenGroupKind,
    read: ModelReadQuery,
    parent: UUID?,
): ModelReadItems<TokenGroup> {
    val limit = read.limit ?: 50
    if (limit !in 1..200 || read.scope.isEmpty()) throw InvalidModelReadQueryException()
    val binding = groupPageBinding(read.scope, designSystemId, kind, parent)
    val after = read.cursor?.let { decodeGroupCursor(it, binding) }
    val rows = TransactionManager.current().exec(
        groupPageSql(parent, after),
        groupPageArgs(designSystemId, kind, parent, after, limit),
        explicitStatementType = StatementType.SELECT,
    ) { result -> readGroupPageRows(result, designSystemId, kind) }.orEmpty()
    val next = rows.getOrNull(limit - 1)?.first?.takeIf { rows.size > limit }
        ?.let { encodeGroupCursor(binding, it) }
    return ModelReadItems(rows.take(limit).map { it.second }, ModelReadPage(limit, next))
}

private fun groupPageSql(parent: UUID?, after: GroupPageKey?): String {
    val parentFilter = if (parent == null) "" else "AND g.parent_id = ?"
    val cursorFilter = when (after?.level) {
        null -> ""
        0 -> "AND ((root.position, root.id) > (?, ?) OR (root.id = ? AND g.parent_id IS NOT NULL))"
        else ->
            """AND ((root.position, root.id) > (?, ?) OR
            (root.id = ? AND g.parent_id IS NOT NULL AND (g.position, g.id) > (?, ?)))"""
    }
    return """
            WITH visible AS NOT MATERIALIZED (${TokenGroupsTable.revisionSql})
            SELECT g.id, g.parent_id, g.code, g.label, g.position, g.edit_revision,
                   root.id AS root_id, root.position AS root_position
              FROM visible g
              JOIN visible root ON root.id = COALESCE(g.parent_id, g.id)
             WHERE g.design_system_id = ? AND g.kind = ?::token_group_kind
               AND root.design_system_id = ? AND root.kind = ?::token_group_kind
               AND root.parent_id IS NULL
               $parentFilter $cursorFilter
             ORDER BY root.position, root.id, (g.parent_id IS NOT NULL), g.position, g.id
             LIMIT ?
    """.trimIndent()
}

private fun groupPageArgs(
    designSystemId: UUID,
    kind: TokenGroupKind,
    parent: UUID?,
    after: GroupPageKey?,
    limit: Int,
) = buildList {
    add(UUIDColumnType() to designSystemId)
    add(TextColumnType() to kind.wireValue)
    add(UUIDColumnType() to designSystemId)
    add(TextColumnType() to kind.wireValue)
    if (parent != null) add(UUIDColumnType() to parent)
    if (after != null) {
        add(IntegerColumnType() to after.rootPosition)
        add(UUIDColumnType() to after.rootId)
        add(UUIDColumnType() to after.rootId)
        if (after.level != 0) {
            add(IntegerColumnType() to after.position)
            add(UUIDColumnType() to after.id)
        }
    }
    add(IntegerColumnType() to limit + 1)
}

private fun readGroupPageRows(
    result: ResultSet,
    designSystemId: UUID,
    kind: TokenGroupKind,
): List<Pair<GroupPageKey, TokenGroup>> = buildList {
    while (result.next()) {
        val item = TokenGroup(
            id = result.getObject("id", UUID::class.java),
            designSystemId = designSystemId,
            kind = kind,
            parentId = result.getObject("parent_id", UUID::class.java),
            code = result.getString("code"),
            label = result.getString("label"),
            position = result.getInt("position"),
            editRevision = result.getLong("edit_revision"),
        )
        add(
            GroupPageKey(
                result.getInt("root_position"),
                result.getObject("root_id", UUID::class.java),
                if (item.parentId == null) 0 else 1,
                item.position,
                item.id,
            ) to item,
        )
    }
}
