package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.ModelReadItems
import com.dsbuilder.ds.core.application.ModelReadPage
import com.dsbuilder.ds.core.application.ModelReadQuery
import com.dsbuilder.ds.core.data.InvalidModelReadQueryException
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import java.security.MessageDigest
import java.util.Base64
import java.util.UUID

/** Согласует порядок полного списка и страниц двухуровневого дерева групп. */
internal fun pageTokenGroups(
    groups: List<TokenGroup>,
    read: ModelReadQuery,
    designSystemId: UUID,
    kind: TokenGroupKind,
    parentId: UUID?,
): ModelReadItems<TokenGroup> {
    val parents = groups.filter { it.parentId == null }.associateBy(TokenGroup::id)
    val ordered = groups.asSequence()
        .filter { it.parentId == null || it.parentId in parents }
        .filter { parentId == null || it.parentId == parentId }
        .map { group ->
            val root = group.parentId?.let(parents::get) ?: group
            GroupPageKey(
                root.position, root.id, if (group.parentId == null) 0 else 1, group.position, group.id,
            ) to group
        }
        .sortedWith(compareBy { it.first })
        .toList()
    if (read.limit == null && read.cursor == null) {
        return ModelReadItems(ordered.map(Pair<GroupPageKey, TokenGroup>::second))
    }
    val limit = read.limit ?: 50
    if (limit !in 1..200 || read.scope.isEmpty()) throw InvalidModelReadQueryException()
    val binding = groupPageBinding(read.scope, designSystemId, kind, parentId)
    val after = read.cursor?.let { decodeGroupCursor(it, binding) }
    val remaining = if (after == null) ordered else ordered.dropWhile { it.first <= after }
    val items = remaining.take(limit + 1)
    val next = items.getOrNull(limit - 1)?.first?.takeIf { items.size > limit }
        ?.let { encodeGroupCursor(binding, it) }
    return ModelReadItems(items.take(limit).map(Pair<GroupPageKey, TokenGroup>::second), ModelReadPage(limit, next))
}

internal data class GroupPageKey(
    val rootPosition: Int,
    val rootId: UUID,
    val level: Int,
    val position: Int,
    val id: UUID,
) : Comparable<GroupPageKey> {
    override fun compareTo(other: GroupPageKey): Int = compareValuesBy(
        this,
        other,
        GroupPageKey::rootPosition,
        { it.rootId.toString() },
        GroupPageKey::level,
        GroupPageKey::position,
        { it.id.toString() },
    )
}

internal fun groupPageBinding(scope: String, designSystemId: UUID, kind: TokenGroupKind, parentId: UUID?): String =
    MessageDigest.getInstance("SHA-256")
        .digest("$scope|$designSystemId|${kind.wireValue}|$parentId|tree-position-v1".toByteArray())
        .joinToString("") { "%02x".format(it) }

internal fun encodeGroupCursor(binding: String, key: GroupPageKey): String =
    Base64.getUrlEncoder().withoutPadding().encodeToString(
        listOf(binding, key.rootPosition, key.rootId, key.level, key.position, key.id)
            .joinToString("|").toByteArray(),
    )

internal fun decodeGroupCursor(cursor: String, binding: String): GroupPageKey = try {
    if (cursor.length > 8192) throw InvalidModelReadQueryException()
    val parts = String(Base64.getUrlDecoder().decode(cursor)).split('|')
    if (parts.size != 6 || parts[0] != binding) throw InvalidModelReadQueryException()
    val level = parts[3].toInt()
    if (level !in 0..1) throw InvalidModelReadQueryException()
    GroupPageKey(
        parts[1].toInt(),
        UUID.fromString(parts[2]),
        level,
        parts[4].toInt(),
        UUID.fromString(parts[5]),
    )
} catch (_: IllegalArgumentException) {
    throw InvalidModelReadQueryException()
}
