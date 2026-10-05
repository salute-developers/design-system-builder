package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.StateRepository
import com.dsbuilder.ds.components.domain.ComponentState
import com.dsbuilder.ds.components.domain.ComponentStateSet
import com.dsbuilder.ds.components.domain.ResolvedStateSet
import com.dsbuilder.ds.components.domain.StateImpact
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.UUID

/** Exposed persistence for global states and canonical state sets. */
class ExposedStateRepository : StateRepository {
    override suspend fun list(
        projectId: ProjectId,
        systemAdmin: Boolean,
        componentId: UUID?,
        componentFilterPresent: Boolean,
    ): List<ComponentState> {
        return if (componentFilterPresent) {
            ComponentStatesTable.selectAll().where {
                (
                    componentId?.let { ComponentStatesTable.componentId eq it }
                        ?: ComponentStatesTable.componentId.isNull()
                    ) and ComponentOwnership.readableState(ComponentStatesTable.id, projectId, systemAdmin)
            }.map(::componentState)
        } else {
            ComponentStatesTable.selectAll().where {
                ComponentOwnership.readableState(ComponentStatesTable.id, projectId, systemAdmin)
            }.map(::componentState)
        }
    }

    override suspend fun find(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ComponentState? =
        ComponentStatesTable.selectAll().where {
            (ComponentStatesTable.id eq id) and
                ComponentOwnership.readableState(ComponentStatesTable.id, projectId, systemAdmin)
        }.singleOrNull()?.let(::componentState)

    override suspend fun impact(projectId: ProjectId, systemAdmin: Boolean, id: UUID): StateImpact? {
        if (find(projectId, systemAdmin, id) == null) return null
        val readableComponents = ComponentOwnership.readableComponentIds(projectId, systemAdmin)
        if (!systemAdmin && readableComponents.isEmpty()) return StateImpact(0, 0, 0)
        val componentScope = if (systemAdmin) {
            "TRUE"
        } else {
            readableComponents.joinToString(",", prefix = "ARRAY[", postfix = "]::uuid[]") { "'$it'::uuid" }
                .let { ids -> "component_id = ANY($ids)" }
        }
        val designSystemScope = if (systemAdmin) {
            "TRUE"
        } else {
            "(ds.project_id = '${projectId.value.replace("'", "''")}' OR ds.project_id IS NULL)"
        }
        val sql = """
            WITH doomed AS (
              SELECT id FROM state_sets WHERE state_ids @> ARRAY['$id'::uuid]
            ), affected AS (
              SELECT v.state_set_id, vr.component_id
                FROM variation_property_values v
                JOIN doomed d ON d.id = v.state_set_id
                JOIN styles st ON st.id = v.style_id
                JOIN variations vr ON vr.id = st.variation_id
                JOIN design_systems ds ON ds.id = st.design_system_id
               WHERE ${componentScope.replace("component_id", "vr.component_id")} AND $designSystemScope
              UNION ALL
              SELECT v.state_set_id, v.component_id
                FROM invariant_property_values v
                JOIN doomed d ON d.id = v.state_set_id
                JOIN design_systems ds ON ds.id = v.design_system_id
               WHERE ${componentScope.replace("component_id", "v.component_id")} AND $designSystemScope
            )
            SELECT
              (SELECT count(DISTINCT state_set_id) FROM affected)::int AS state_sets,
              (SELECT count(*) FROM affected)::int AS values,
              (SELECT count(DISTINCT component_id) FROM affected)::int AS components
        """.trimIndent()
        return TransactionManager.current().exec(sql, explicitStatementType = StatementType.SELECT) { result ->
            check(result.next())
            StateImpact(result.getInt("state_sets"), result.getInt("values"), result.getInt("components"))
        }
    }

    override suspend fun create(command: StateRepository.Create): ComponentState =
        ComponentStatesTable.insertReturning {
            it[componentId] = command.componentId
            it[name] = command.name
            it[description] = command.description
        }.single().let(::componentState)

    override suspend fun update(id: UUID, command: StateRepository.Update): ComponentState? =
        ComponentStatesTable.updateReturning(where = { ComponentStatesTable.id eq id }) {
            command.name?.let { value -> it[name] = value }
            if (command.descriptionPresent) it[description] = command.description
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::componentState)

    override suspend fun delete(id: UUID): Boolean =
        ComponentStatesTable.deleteWhere { ComponentStatesTable.id eq id } > 0

    override suspend fun listSets(projectId: ProjectId, systemAdmin: Boolean): List<ComponentStateSet> =
        ComponentStateSetsTable.selectAll().where {
            ComponentOwnership.readableStateSet(ComponentStateSetsTable.id, projectId, systemAdmin)
        }.map(::componentStateSet)

    override suspend fun findSet(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ComponentStateSet? =
        ComponentStateSetsTable.selectAll().where {
            (ComponentStateSetsTable.id eq id) and
                ComponentOwnership.readableStateSet(ComponentStateSetsTable.id, projectId, systemAdmin)
        }.singleOrNull()?.let(::componentStateSet)

    @Suppress("ReturnCount")
    override suspend fun resolve(stateIds: List<UUID>): StateRepository.Resolution {
        val canonical = stateIds.distinct().sorted()
        val states = ComponentStatesTable.selectAll()
            .where { ComponentStatesTable.id inList canonical }
            .map(::componentState)
        if (states.size != canonical.size) {
            return StateRepository.Resolution.Invalid("state set contains a state that does not exist")
        }
        if (states.mapNotNull(ComponentState::componentId).distinct().size > 1) {
            return StateRepository.Resolution.Invalid("state set mixes component states from different components")
        }
        val existing = ComponentStateSetsTable.selectAll()
            .where { ComponentStateSetsTable.stateIds eq canonical }
            .singleOrNull()
            ?.let(::componentStateSet)
        if (existing != null) return StateRepository.Resolution.Success(ResolvedStateSet(existing, false))
        val created = ComponentStateSetsTable.insertReturning {
            it[ComponentStateSetsTable.stateIds] = canonical
        }.single().let(::componentStateSet)
        return StateRepository.Resolution.Success(ResolvedStateSet(created, true))
    }
}

private fun componentState(row: ResultRow) = ComponentState(
    row[ComponentStatesTable.id],
    row[ComponentStatesTable.componentId],
    row[ComponentStatesTable.name],
    row[ComponentStatesTable.description],
    row[ComponentStatesTable.createdAt],
    row[ComponentStatesTable.updatedAt],
)

private fun componentStateSet(row: ResultRow) = ComponentStateSet(
    row[ComponentStateSetsTable.id],
    row[ComponentStateSetsTable.stateIds],
    row[ComponentStateSetsTable.ownerComponentId],
    row[ComponentStateSetsTable.createdAt],
    row[ComponentStateSetsTable.updatedAt],
)
