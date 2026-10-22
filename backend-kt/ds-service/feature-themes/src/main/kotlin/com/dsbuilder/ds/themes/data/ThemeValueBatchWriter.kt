package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.lockDraftSubjects
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import java.time.Instant
import java.util.UUID

/** Пишет однородное изменение значений пакетами, сохраняя блокировки, пути и редакции каждой сущности. */
internal fun writeThemeValueRevisions(owner: UUID, values: Map<UUID, ThemeValuePayload>) {
    if (values.isEmpty()) return
    val ids = values.keys.sorted()
    check(lockDraftSubjects(owner, "token-value", ids))
    val draft = requireNotNull(themeDraft(owner))
    val boundary = draft[ThemeVersionBoundariesTable.id]
    val now = Instant.now()
    ids.chunked(250).forEach { batch ->
        ThemeTokenValueRevisionsTable.deleteWhere {
            (tokenValueId inList batch) and (designSystemVersionId eq boundary)
        }
        SubjectMutationPaths.with(setOf("/palette_id", "/value")) {
            ThemeTokenValueRevisionsTable.batchInsert(batch, shouldReturnGeneratedValues = false) { entity ->
                val payload = values.getValue(entity)
                this[ThemeTokenValueRevisionsTable.id] = UUID.randomUUID()
                this[ThemeTokenValueRevisionsTable.tokenValueId] = entity
                this[ThemeTokenValueRevisionsTable.designSystemId] = owner
                this[ThemeTokenValueRevisionsTable.designSystemVersionId] = boundary
                this[ThemeTokenValueRevisionsTable.versionSequenceNumber] =
                    draft[ThemeVersionBoundariesTable.sequenceNumber]
                this[ThemeTokenValueRevisionsTable.paletteId] = payload.paletteId
                this[ThemeTokenValueRevisionsTable.value] = payload.value
                this[ThemeTokenValueRevisionsTable.deleted] = false
                this[ThemeTokenValueRevisionsTable.updatedAt] = now
            }
        }
    }
}
