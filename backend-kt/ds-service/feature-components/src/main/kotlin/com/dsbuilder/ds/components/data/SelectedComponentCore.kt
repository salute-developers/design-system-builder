package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.EditorRuleViolationException
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Неизвестный ID остаётся 404; известная платформа без выбора имеет отдельный конфликт. */
internal fun requireSelectedComponentCore(componentId: UUID) {
    val component = StableComponentsTable.selectAll().where { StableComponentsTable.id eq componentId }
        .singleOrNull() ?: return
    val platform = component[StableComponentsTable.platform].wireValue
    val selected = TransactionManager.current().exec(
        "SELECT ds_selected_core_release(?::component_platform) IS NOT NULL",
        listOf(TextColumnType() to platform),
    ) { rows -> rows.next() && rows.getBoolean(1) } == true
    if (!selected) {
        throw EditorRuleViolationException(
            "CORE_SELECTION_REQUIRED",
            "Choose Core for $platform first",
            conflict = true,
        )
    }
}
