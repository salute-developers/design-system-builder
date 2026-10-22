package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.data.ExposedDraftChangeHandler
import com.dsbuilder.ds.core.data.SubjectMutationPaths
import kotlinx.serialization.json.JsonObject
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Предметные обработчики журнала токенов и их значений. */
fun tokenDraftChangeHandlers(): List<DraftChangeHandler> = listOf(
    ExposedDraftChangeHandler(
        entityType = "token",
        stableTable = TokensTable,
        stableId = TokensTable.id,
        stableDesignSystemId = TokensTable.designSystemId,
        revisionTable = TokenRevisionsTable,
        revisionEntityId = TokenRevisionsTable.tokenId,
        revisionVersionId = TokenRevisionsTable.designSystemVersionId,
        revisionSequenceNumber = TokenRevisionsTable.versionSequenceNumber,
        revisionDeleted = TokenRevisionsTable.deleted,
        revisionValueColumns = listOf(
            TokenRevisionsTable.name,
            TokenRevisionsTable.type,
            TokenRevisionsTable.displayName,
            TokenRevisionsTable.description,
            TokenRevisionsTable.enabled,
            TokenRevisionsTable.groupId,
            TokenRevisionsTable.position,
        ),
    ),
    tokenValueDraftChangeHandler(),
)

private fun tokenValueDraftChangeHandler(): DraftChangeHandler {
    val delegate = ExposedDraftChangeHandler(
        entityType = "token-value",
        stableTable = TokenValuesTable,
        stableId = TokenValuesTable.id,
        stableDesignSystemId = TokenValuesTable.designSystemId,
        revisionTable = TokenValueRevisionsTable,
        revisionEntityId = TokenValueRevisionsTable.tokenValueId,
        revisionVersionId = TokenValueRevisionsTable.designSystemVersionId,
        revisionSequenceNumber = TokenValueRevisionsTable.versionSequenceNumber,
        revisionDeleted = TokenValueRevisionsTable.deleted,
        stableValueColumns = listOf(
            TokenValuesTable.tokenId,
            TokenValuesTable.tenantId,
            TokenValuesTable.platform,
            TokenValuesTable.mode,
        ),
        revisionValueColumns = listOf(TokenValueRevisionsTable.paletteId, TokenValueRevisionsTable.value),
    )
    return object : DraftChangeHandler by delegate {
        override fun revertFields(
            versionId: UUID,
            entityId: UUID,
            previous: JsonObject,
            current: JsonObject,
            paths: Set<String>,
        ): Boolean = revertTokenValueFields(versionId, entityId, previous, current, paths)

        override fun revert(versionId: UUID, entityId: UUID, removeStableEntity: Boolean): Boolean {
            return if (removeStableEntity) {
                delegate.revert(versionId, entityId, true)
            } else {
                val baseline = TokenValueCreationBaselinesTable.selectAll().where {
                    (TokenValueCreationBaselinesTable.designSystemVersionId eq versionId) and
                        (TokenValueCreationBaselinesTable.tokenValueId eq entityId)
                }.singleOrNull()
                if (baseline == null) {
                    delegate.revert(versionId, entityId, false)
                } else {
                    val current = TokenValueRevisionsTable.selectAll().where {
                        (TokenValueRevisionsTable.designSystemVersionId eq versionId) and
                            (TokenValueRevisionsTable.tokenValueId eq entityId)
                    }.singleOrNull() ?: return false
                    TokenValueRevisionsTable.deleteWhere {
                        (TokenValueRevisionsTable.designSystemVersionId eq versionId) and
                            (TokenValueRevisionsTable.tokenValueId eq entityId)
                    }
                    SubjectMutationPaths.with(setOf("/palette_id", "/value")) {
                        TokenValueRevisionsTable.insert {
                            it[tokenValueId] = entityId
                            it[designSystemId] = current[TokenValueRevisionsTable.designSystemId]
                            it[designSystemVersionId] = versionId
                            it[versionSequenceNumber] = current[TokenValueRevisionsTable.versionSequenceNumber]
                            it[paletteId] = baseline[TokenValueCreationBaselinesTable.paletteId]
                            it[value] = baseline[TokenValueCreationBaselinesTable.value]
                            it[deleted] = false
                        }
                    }
                    true
                }
            }
        }
    }
}
