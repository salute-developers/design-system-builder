package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.components.domain.StateNames
import com.dsbuilder.ds.components.domain.StateSetRule
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.select
import java.util.UUID

/**
 * Проверка набора состояний значения по признаку свойства (правило [StateSetRule]). Вызывается в транзакции
 * записи: так признак, изменённый импортом меты после чтения бандла, учитывается. Удаление, переупорядочивание,
 * копирование и импорт конфигураций проверку не вызывают.
 */
internal object PropertyStateSetGuard {
    /** Отклоняет набор [stateSetId] свойства [propertyId]: `state_not_in_component` или `states_not_supported`. */
    fun requireAllowedSet(propertyId: UUID, stateSetId: UUID) {
        // Значение без состояний — большинство записей автосохранения: проверять нечего, запросов нет.
        if (stateSetId == EMPTY_STATE_SET_ID) return
        val stateIds = ComponentStateSetsTable.select(ComponentStateSetsTable.stateIds)
            .where { ComponentStateSetsTable.id eq stateSetId }
            .singleOrNull()?.get(ComponentStateSetsTable.stateIds) ?: return
        requireAllowed(propertyId, stateIds)
    }

    /** Отклоняет набор состояний [stateIds] для свойства [propertyId]. */
    fun requireAllowed(propertyId: UUID, stateIds: List<UUID>) {
        if (stateIds.isEmpty()) return
        val property = PropertiesTable.select(PropertiesTable.componentId, PropertiesTable.stateCombinations)
            .where { PropertiesTable.id eq propertyId }
            .singleOrNull() ?: return
        val componentId = property[PropertiesTable.componentId]
        val combinations = property[PropertiesTable.stateCombinations]
        val set = scoped(stateIds.distinct())
        val supported = if (combinations == null) null else supportedStates(propertyId)
        when (StateSetRule.check(componentId, supported, combinations == true, set)) {
            StateSetRule.Verdict.ALLOWED -> Unit
            StateSetRule.Verdict.FOREIGN_STATE -> throw EditorRuleViolationException(
                "state_not_in_component",
                "The state set contains a state of another component",
            )
            StateSetRule.Verdict.NOT_SUPPORTED -> throw EditorRuleViolationException(
                "states_not_supported",
                "The property does not support this set of states",
            )
        }
    }

    /** Набор без состояний: строка-сентинел базовой миграции с фиксированным идентификатором. */
    private val EMPTY_STATE_SET_ID: UUID = UUID.fromString("00000000-0000-4000-8000-0000000000ff")

    /** Состояния списка признака одним соединением с `states`. */
    private fun supportedStates(propertyId: UUID) = PropertySupportedStatesTable.join(
        ComponentStatesTable,
        JoinType.INNER,
        PropertySupportedStatesTable.stateId,
        ComponentStatesTable.id,
    ).select(ComponentStatesTable.componentId, ComponentStatesTable.name)
        .where { PropertySupportedStatesTable.propertyId eq propertyId }
        .map { StateNames.Scoped(it[ComponentStatesTable.componentId], it[ComponentStatesTable.name]) }

    private fun scoped(ids: List<UUID>): List<StateNames.Scoped> {
        if (ids.isEmpty()) return emptyList()
        return ComponentStatesTable.select(ComponentStatesTable.componentId, ComponentStatesTable.name)
            .where { ComponentStatesTable.id inList ids }
            .map { StateNames.Scoped(it[ComponentStatesTable.componentId], it[ComponentStatesTable.name]) }
    }
}
