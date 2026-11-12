package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.application.DraftChangeDependencyValidator
import com.dsbuilder.ds.core.application.LiteralValueBatchContext
import com.dsbuilder.ds.core.application.LiteralValueBatchParticipant
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Отмена отсоединения свойства сначала требует восстановить удалённый токен. */
class ComponentTokenRevertDependencyValidator : DraftChangeDependencyValidator, LiteralValueBatchParticipant {
    override fun validLiteralBatch(context: LiteralValueBatchContext): Boolean =
        context.values.none {
            it.entityType in setOf("variation-property-value", "invariant-property-value", "style-combination")
        }

    override suspend fun valid(designSystemId: UUID, entityType: String, entityId: UUID): Boolean {
        val tokenId = when (entityType) {
            "variation-property-value" -> VariationPropertyValuesTable.selectAll().where {
                (VariationPropertyValuesTable.id eq entityId) and
                    (VariationPropertyValuesTable.designSystemId eq designSystemId)
            }.singleOrNull()?.get(VariationPropertyValuesTable.tokenId)
            "invariant-property-value" -> InvariantPropertyValuesTable.selectAll().where {
                (InvariantPropertyValuesTable.id eq entityId) and
                    (InvariantPropertyValuesTable.designSystemId eq designSystemId)
            }.singleOrNull()?.get(InvariantPropertyValuesTable.tokenId)
            "style-combination" -> StyleCombinationsTable.selectAll().where {
                (StyleCombinationsTable.id eq entityId) and
                    (StyleCombinationsTable.designSystemId eq designSystemId)
            }.singleOrNull()?.get(StyleCombinationsTable.tokenId)
            else -> null
        } ?: return true
        return ComponentTokensTable.selectAll().where {
            (ComponentTokensTable.id eq tokenId) and (ComponentTokensTable.designSystemId eq designSystemId)
        }.limit(1).any()
    }
}
