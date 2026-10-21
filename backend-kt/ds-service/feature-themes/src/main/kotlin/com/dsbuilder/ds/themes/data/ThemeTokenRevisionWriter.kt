package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.core.data.lockDraftSubjects
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant
import java.util.UUID

internal fun reviseThemeToken(tokenId: UUID, paths: Set<String>, transform: (ThemeTokenPayload) -> ThemeTokenPayload) {
    val owner = currentThemeTokenRows(tokenIds = setOf(tokenId)).singleOrNull()
        ?.get(ThemeTokensTable.designSystemId) ?: return
    lockDraftSubject(owner, "token", tokenId)
    // Повторное чтение после предметной блокировки сохраняет соседние поля конкурентного запроса.
    val row = currentThemeTokenRows(owner, setOf(tokenId)).singleOrNull() ?: return
    val before = ThemeTokenPayload(
        row[ThemeTokenRevisionsTable.name],
        row[ThemeTokenRevisionsTable.type],
        row[ThemeTokenRevisionsTable.displayName],
        row[ThemeTokenRevisionsTable.description],
        row[ThemeTokenRevisionsTable.enabled],
        row[ThemeTokenRevisionsTable.groupId],
        row[ThemeTokenRevisionsTable.position],
    )
    val after = transform(before)
    if (before != after) writeThemeTokenRevision(tokenId, owner, after, paths)
}

internal fun writeThemeTokenRevision(tokenId: UUID, owner: UUID, payload: ThemeTokenPayload, paths: Set<String>) {
    lockDraftSubject(owner, "token", tokenId)
    val draft = requireNotNull(themeDraft(owner))
    ThemeTokenRevisionsTable.deleteWhere {
        (ThemeTokenRevisionsTable.tokenId eq tokenId) and
            (designSystemVersionId eq draft[ThemeVersionBoundariesTable.id])
    }
    SubjectMutationPaths.with(paths) {
        ThemeTokenRevisionsTable.insert {
            it[id] = UUID.randomUUID()
            it[ThemeTokenRevisionsTable.tokenId] = tokenId
            it[designSystemId] = owner
            it[designSystemVersionId] = draft[ThemeVersionBoundariesTable.id]
            it[versionSequenceNumber] = draft[ThemeVersionBoundariesTable.sequenceNumber]
            it[name] = payload.name
            it[type] = payload.type
            it[displayName] = payload.displayName
            it[description] = payload.description
            it[enabled] = payload.enabled
            it[groupId] = payload.groupId
            it[position] = payload.position
            it[deleted] = payload.deleted
            it[updatedAt] = Instant.now()
        }
    }
}

/**
 * Записывает черновую редакцию значения. [overridden] — признак своего значения платформы; `null` сохраняет признак
 * последней редакции значения, чтобы запись, которая его не меняет, не сбрасывала своё значение ios или android.
 */
@Suppress("LongParameterList")
internal fun writeThemeValueRevision(
    entity: UUID,
    owner: UUID,
    palette: UUID?,
    data: JsonElement?,
    removed: Boolean = false,
    paths: Set<String> = setOf("/palette_id", "/value"),
    baseRevision: Long? = null,
    overridden: Boolean? = null,
) {
    lockDraftSubject(owner, "token-value", entity)
    val draft = requireNotNull(themeDraft(owner))
    val flag = overridden ?: latestThemeValueOverridden(entity)
    ThemeTokenValueRevisionsTable.deleteWhere {
        (tokenValueId eq entity) and (designSystemVersionId eq draft[ThemeVersionBoundariesTable.id])
    }
    SubjectMutationPaths.with(paths, baseRevision) {
        ThemeTokenValueRevisionsTable.insert {
            it[id] = UUID.randomUUID()
            it[tokenValueId] = entity
            it[designSystemId] = owner
            it[designSystemVersionId] = draft[ThemeVersionBoundariesTable.id]
            it[versionSequenceNumber] = draft[ThemeVersionBoundariesTable.sequenceNumber]
            it[paletteId] = palette
            it[value] = data
            it[ThemeTokenValueRevisionsTable.overridden] = flag
            it[deleted] = removed
            it[updatedAt] = Instant.now()
        }
    }
}

/** Признак своего значения платформы последней редакции значения [entity]; без редакций — `false`. */
internal fun latestThemeValueOverridden(entity: UUID): Boolean = ThemeTokenValueRevisionsTable.selectAll()
    .where { ThemeTokenValueRevisionsTable.tokenValueId eq entity }
    .orderBy(ThemeTokenValueRevisionsTable.versionSequenceNumber, SortOrder.DESC)
    .limit(1)
    .singleOrNull()
    ?.get(ThemeTokenValueRevisionsTable.overridden) ?: false

/** Удаляет значения семейства одной пакетной записью, сохраняя предметные блокировки и историю. */
internal fun deleteThemeValues(tokenIds: Set<UUID>) {
    if (tokenIds.isEmpty()) return
    val rowsByOwner = currentThemeTokenValueRows(tokenIds = tokenIds)
        .groupBy { it[ThemeTokenValuesTable.designSystemId] }
    rowsByOwner.forEach { (owner, rows) ->
        val draft = requireNotNull(themeDraft(owner))
        val boundary = draft[ThemeVersionBoundariesTable.id]
        val ids = rows.map { it[ThemeTokenValuesTable.id] }.sorted()
        check(lockDraftSubjects(owner, "token-value", ids))
        ids.chunked(250).forEach { batch ->
            ThemeTokenValueRevisionsTable.deleteWhere {
                (tokenValueId inList batch) and (designSystemVersionId eq boundary)
            }
            SubjectMutationPaths.with(setOf("/deleted")) {
                ThemeTokenValueRevisionsTable.batchInsert(batch, shouldReturnGeneratedValues = false) { entity ->
                    this[ThemeTokenValueRevisionsTable.id] = UUID.randomUUID()
                    this[ThemeTokenValueRevisionsTable.tokenValueId] = entity
                    this[ThemeTokenValueRevisionsTable.designSystemId] = owner
                    this[ThemeTokenValueRevisionsTable.designSystemVersionId] = boundary
                    this[ThemeTokenValueRevisionsTable.versionSequenceNumber] =
                        draft[ThemeVersionBoundariesTable.sequenceNumber]
                    this[ThemeTokenValueRevisionsTable.paletteId] = null
                    this[ThemeTokenValueRevisionsTable.value] = null
                    this[ThemeTokenValueRevisionsTable.deleted] = true
                    this[ThemeTokenValueRevisionsTable.updatedAt] = Instant.now()
                }
            }
        }
    }
}
