package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.components.domain.PropertyStateSupport
import com.dsbuilder.ds.components.domain.StateNames
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNotNull
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.batchInsert
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.util.UUID

/** Чтение и запись признака поддержки состояний свойств. Вызывается внутри транзакции. */
internal object PropertyStateSupportStore {
    private const val CHUNK_SIZE = 1000

    /** Признаки свойств [ids]; свойства без признака в результат не попадают. */
    fun load(ids: Collection<UUID>): Map<UUID, PropertyStateSupport> {
        val combinations = HashMap<UUID, Boolean>()
        ids.distinct().chunked(CHUNK_SIZE).forEach { part ->
            PropertiesTable.select(PropertiesTable.id, PropertiesTable.stateCombinations)
                .where { (PropertiesTable.id inList part) and PropertiesTable.stateCombinations.isNotNull() }
                .forEach { row ->
                    row[PropertiesTable.stateCombinations]?.let { combinations[row[PropertiesTable.id]] = it }
                }
        }
        val states = statesOf(combinations.keys)
        return combinations.mapValues { (id, flag) -> PropertyStateSupport(states[id].orEmpty(), flag) }
    }

    /**
     * Дополняет свойства списком состояний признака. Флаг уже прочитан со строкой свойства, поэтому запрос идёт
     * только за списками и только для свойств с заданным признаком.
     */
    fun attach(properties: List<ComponentPropertySummary>): List<ComponentPropertySummary> {
        val states = statesOf(properties.filter { it.stateSupport != null }.map { it.id })
        return properties.map { property ->
            val support = property.stateSupport ?: return@map property
            property.copy(stateSupport = support.copy(stateIds = states[property.id].orEmpty()))
        }
    }

    /** Списки состояний признака по свойствам [ids], каждый в порядке создания состояний. */
    private fun statesOf(ids: Collection<UUID>): Map<UUID, List<UUID>> {
        val states = HashMap<UUID, MutableList<UUID>>()
        ids.distinct().chunked(CHUNK_SIZE).forEach { part ->
            PropertySupportedStatesTable.join(
                ComponentStatesTable,
                JoinType.INNER,
                PropertySupportedStatesTable.stateId,
                ComponentStatesTable.id,
            ).select(PropertySupportedStatesTable.propertyId, PropertySupportedStatesTable.stateId)
                .where { PropertySupportedStatesTable.propertyId inList part }
                .orderBy(ComponentStatesTable.createdAt to SortOrder.ASC, ComponentStatesTable.id to SortOrder.ASC)
                .forEach { row ->
                    states.getOrPut(row[PropertySupportedStatesTable.propertyId]) { mutableListOf() } +=
                        row[PropertySupportedStatesTable.stateId]
                }
        }
        return states
    }

    /** Заменяет признаки свойств [supports] пакетно: число запросов не зависит от числа свойств в части. */
    fun replace(supports: Map<UUID, PropertyStateSupport>) {
        supports.keys.chunked(CHUNK_SIZE).forEach { part ->
            part.groupBy { supports.getValue(it).combinations }.forEach { (flag, ids) ->
                PropertiesTable.update({ PropertiesTable.id inList ids }) { it[stateCombinations] = flag }
            }
            PropertySupportedStatesTable.deleteWhere { PropertySupportedStatesTable.propertyId inList part }
            val rows = part.flatMap { id -> supports.getValue(id).stateIds.distinct().map { id to it } }
            PropertySupportedStatesTable.batchInsert(rows, shouldReturnGeneratedValues = false) { (property, state) ->
                this[PropertySupportedStatesTable.propertyId] = property
                this[PropertySupportedStatesTable.stateId] = state
            }
        }
    }

    /**
     * Переводит списки признака с «теней» общих состояний [names] на сами общие состояния. Новое общее состояние
     * делает «тенью» одноимённое собственное состояние компонента, на которое уже ссылаются признаки; без перевода
     * такие идентификаторы не попадают в бандл (он «тени» не отдаёт), и редактор терял бы состояние до переимпорта.
     */
    fun moveSupportOffShadows(names: Collection<String>) {
        val keys = names.mapTo(hashSetOf(), StateNames::canonical)
        if (keys.isEmpty()) return
        val states = scopedStates(null, all = true).filter { StateNames.canonical(it.scope.name) in keys }
        // Первое по порядку создания, как в StateNames.resolve.
        val common = states.filter { it.scope.componentId == null }
            .groupBy { StateNames.canonical(it.scope.name) }.mapValues { (_, same) -> same.first().id }
        val shadows = states.filter { it.scope.componentId != null }
            .mapNotNull { state -> common[StateNames.canonical(state.scope.name)]?.let { state.id to it } }
            .toMap()
        shadows.keys.chunked(CHUNK_SIZE).forEach { part ->
            val rows = PropertySupportedStatesTable.selectAll()
                .where { PropertySupportedStatesTable.stateId inList part }
                .map { row ->
                    row[PropertySupportedStatesTable.propertyId] to
                        shadows.getValue(row[PropertySupportedStatesTable.stateId])
                }
            PropertySupportedStatesTable.batchInsert(rows, ignore = true, shouldReturnGeneratedValues = false) {
                this[PropertySupportedStatesTable.propertyId] = it.first
                this[PropertySupportedStatesTable.stateId] = it.second
            }
            PropertySupportedStatesTable.deleteWhere { PropertySupportedStatesTable.stateId inList part }
        }
    }

    /** Состояния, которые видит компонент [componentId]: общие и собственные. */
    fun scopedStates(componentId: UUID?, all: Boolean = false): List<ScopedState> =
        ComponentStatesTable
            .select(ComponentStatesTable.id, ComponentStatesTable.componentId, ComponentStatesTable.name)
            .where {
                when {
                    all -> Op.TRUE
                    componentId != null ->
                        ComponentStatesTable.componentId.isNull() or (ComponentStatesTable.componentId eq componentId)
                    else -> ComponentStatesTable.componentId.isNull()
                }
            }
            .orderBy(ComponentStatesTable.createdAt to SortOrder.ASC, ComponentStatesTable.id to SortOrder.ASC)
            .map {
                ScopedState(
                    it[ComponentStatesTable.id],
                    StateNames.Scoped(it[ComponentStatesTable.componentId], it[ComponentStatesTable.name]),
                )
            }

    /** Состояние с принадлежностью. */
    data class ScopedState(val id: UUID, val scope: StateNames.Scoped)
}
