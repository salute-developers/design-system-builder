package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.core.data.lockDraftSubjects
import kotlinx.serialization.json.JsonElement
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import java.time.Instant
import java.util.UUID

internal fun reviseThemeToken(
    tokenId: UUID,
    paths: Set<String>,
    baseRevision: Long? = null,
    transform: (ThemeTokenPayload) -> ThemeTokenPayload,
) {
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
    if (before != after) writeThemeTokenRevision(tokenId, owner, after, paths, baseRevision)
}

internal fun writeThemeTokenRevision(
    tokenId: UUID,
    owner: UUID,
    payload: ThemeTokenPayload,
    paths: Set<String>,
    baseRevision: Long? = null,
) {
    lockDraftSubject(owner, "token", tokenId)
    val draft = requireNotNull(themeDraft(owner))
    ThemeTokenRevisionsTable.deleteWhere {
        (ThemeTokenRevisionsTable.tokenId eq tokenId) and
            (designSystemVersionId eq draft[ThemeVersionBoundariesTable.id])
    }
    SubjectMutationPaths.with(paths, baseRevision) {
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

internal fun writeThemeValueRevision(
    entity: UUID,
    owner: UUID,
    palette: UUID?,
    data: JsonElement?,
    overridden: Boolean,
    removed: Boolean = false,
    paths: Set<String> = setOf("/palette_id", "/value"),
    baseRevision: Long? = null,
) {
    lockDraftSubject(owner, "token-value", entity)
    val draft = requireNotNull(themeDraft(owner))
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
            it[ThemeTokenValueRevisionsTable.overridden] = overridden
            it[deleted] = removed
            it[updatedAt] = Instant.now()
        }
    }
}

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
