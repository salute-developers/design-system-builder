package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.EditorRuleViolationException
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Проверяет одну вложенную ссылку без загрузки настроек всей ДС. */
internal fun validateCoreReference(propertyId: UUID, target: ResultRow) {
    val componentId = target[ComponentAppearancesTable.componentId]
    val designSystemId = target[ComponentAppearancesTable.designSystemId]
    val active = DesignSystemComponentsTable.selectAll().where {
        (DesignSystemComponentsTable.designSystemId eq designSystemId) and
            (DesignSystemComponentsTable.componentId eq componentId)
    }.any()
    val allowed = TransactionManager.current().exec(
        """
        SELECT EXISTS (
            SELECT 1 FROM core_release_properties p
            JOIN core_releases r ON r.id = p.release_id
            JOIN core_release_components target ON target.release_id = r.id AND target.component_id = ?
            WHERE p.property_id = ? AND r.id = ds_selected_core_release(r.platform)
              AND (p.component_targets = '[]'::jsonb OR p.component_targets @> jsonb_build_array(target.name))
        )
        """.trimIndent(),
        listOf(UUIDColumnType() to componentId, UUIDColumnType() to propertyId),
    ) { rows -> rows.next() && rows.getBoolean(1) } == true
    if (!active || !allowed) {
        throw EditorRuleViolationException(
            "component_target_unavailable",
            "The target is not allowed by the current Core",
        )
    }
}
