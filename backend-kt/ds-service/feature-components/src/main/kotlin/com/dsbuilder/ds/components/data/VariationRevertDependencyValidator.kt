package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.application.DraftChangeDependencyValidator
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Отклоняет отмену изменения оси, если восстановленное имя конфликтует в компоненте или оформлении. */
class VariationRevertDependencyValidator : DraftChangeDependencyValidator {
    override suspend fun valid(designSystemId: UUID, entityType: String, entityId: UUID): Boolean =
        entityType != "variation" || validNames(designSystemId, entityId)

    private fun validNames(designSystemId: UUID, entityId: UUID): Boolean {
        val restored = VariationsTable.selectAll().where {
            (VariationsTable.id eq entityId) and (VariationsTable.designSystemId eq designSystemId)
        }.singleOrNull() ?: return true
        val name = restored[VariationsTable.name].trim().lowercase()
        val catalogConflict = VariationsTable.selectAll().where {
            (VariationsTable.designSystemId eq designSystemId) and
                (VariationsTable.componentId eq restored[VariationsTable.componentId])
        }.any { it[VariationsTable.id] != entityId && it[VariationsTable.name].trim().lowercase() == name }
        return !catalogConflict && AppearanceVariationsTable.selectAll().where {
            (AppearanceVariationsTable.variationId eq entityId) and
                (AppearanceVariationsTable.designSystemId eq designSystemId)
        }.all { axis ->
            !axis[AppearanceVariationsTable.displayName].isNullOrBlank() ||
                name !in AppearanceEditorRules.axisNames(
                    axis[AppearanceVariationsTable.appearanceId],
                    excluding = axis[AppearanceVariationsTable.id],
                )
        }
    }
}
