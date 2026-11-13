package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.lockDraftSubjects
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenValue
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant
import java.util.UUID

/** Пакетная замена значений с отдельными основаниями и путями предметных изменений. */
internal fun replaceColorValues(tenant: UUID, values: Map<UUID, List<ColorTokenValue>>) {
    if (values.isEmpty()) return
    val owner = requireNotNull(currentTenantRows(tenantId = tenant).singleOrNull())[TenantsTable.designSystemId]
    val stable = ThemeTokenValuesTable.selectAll().where {
        (ThemeTokenValuesTable.tenantId eq tenant) and (ThemeTokenValuesTable.tokenId inList values.keys)
    }.associate { row ->
        Triple(
            row[ThemeTokenValuesTable.tokenId], row[ThemeTokenValuesTable.platform],
            row[ThemeTokenValuesTable.mode],
        ) to
            row[ThemeTokenValuesTable.id]
    }.toMutableMap()
    val addressed = values.toSortedMap().flatMap { (token, items) ->
        items.map { item ->
            val key = Triple(token, item.platform, item.mode)
            val id = stable.getOrPut(key) {
                UUID.randomUUID().also { entity ->
                    ThemeTokenValuesTable.insert {
                        it[ThemeTokenValuesTable.id] = entity
                        it[designSystemId] = owner
                        it[tokenId] = token
                        it[tenantId] = tenant
                        it[platform] = item.platform
                        it[mode] = item.mode
                        it[createdAt] = Instant.now()
                    }
                }
            }
            id to item
        }
    }
    check(lockDraftSubjects(owner, "token-value", addressed.map { it.first }))
    val before = currentThemeTokenValueRows(owner, setOf(tenant), values.keys)
        .associateBy { it[ThemeTokenValuesTable.id] }
    val changes = addressed.mapNotNull { (id, item) ->
        val paths = changedPaths(before[id], item)
        if (paths.isEmpty()) null else ColorValueChange(id, item, paths)
    }.sortedBy { it.id }
    if (changes.isEmpty()) return
    val draft = requireNotNull(themeDraft(owner))
    writeColorChanges(owner, draft, changes)
}

private fun writeColorChanges(owner: UUID, draft: ResultRow, changes: List<ColorValueChange>) {
    val boundary = draft[ThemeVersionBoundariesTable.id]
    changes.chunked(250).forEach { batch ->
        ThemeTokenValueRevisionsTable.deleteWhere {
            (tokenValueId inList batch.map { it.id }) and (designSystemVersionId eq boundary)
        }
    }
    // Триггер читает собственное основание каждого адреса. Группировать можно только одинаковый контекст.
    changes.groupBy { it.item.baseRevision to it.paths }.forEach { (context, group) ->
        group.chunked(250).forEach { batch ->
            SubjectMutationPaths.with(context.second, context.first) {
                ThemeTokenValueRevisionsTable.batchInsert(batch, shouldReturnGeneratedValues = false) { change ->
                    this[ThemeTokenValueRevisionsTable.id] = UUID.randomUUID()
                    this[ThemeTokenValueRevisionsTable.tokenValueId] = change.id
                    this[ThemeTokenValueRevisionsTable.designSystemId] = owner
                    this[ThemeTokenValueRevisionsTable.designSystemVersionId] = boundary
                    this[ThemeTokenValueRevisionsTable.versionSequenceNumber] =
                        draft[ThemeVersionBoundariesTable.sequenceNumber]
                    this[ThemeTokenValueRevisionsTable.paletteId] = change.item.paletteId
                    this[ThemeTokenValueRevisionsTable.value] = change.item.value
                    this[ThemeTokenValueRevisionsTable.overridden] = change.item.overridden
                    this[ThemeTokenValueRevisionsTable.deleted] = false
                    this[ThemeTokenValueRevisionsTable.updatedAt] = Instant.now()
                }
            }
        }
    }
}

private data class ColorValueChange(val id: UUID, val item: ColorTokenValue, val paths: Set<String>)

private fun changedPaths(before: ResultRow?, item: ColorTokenValue): Set<String> = buildSet {
    if (before == null || before[ThemeTokenValueRevisionsTable.paletteId] != item.paletteId ||
        before[ThemeTokenValueRevisionsTable.value] != item.value
    ) {
        addAll(listOf("/palette_id", "/value"))
    }
    if (before == null || before[ThemeTokenValueRevisionsTable.overridden] != item.overridden) add("/overridden")
}
