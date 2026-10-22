package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.components.application.StateRepository
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Техническая редакция сущности в черновике (`entity_edit_states`). */
internal object EntityEditStatesTable : Table("entity_edit_states") {
    val designSystemVersionId = uuid("design_system_version_id")
    val entityType = text("entity_type")
    val entityId = uuid("entity_id")
    val revision = long("revision")
}

/** Общие запросы и проверки операций редактора оформления. */
internal object EditorSupport {
    /** Оформление, которое участник вправе изменять, либо `null`. */
    fun writableAppearance(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ResultRow? =
        ComponentAppearancesTable.selectAll().where {
            (ComponentAppearancesTable.id eq id) and
                ComponentOwnership.writableDesignSystem(
                    ComponentAppearancesTable.designSystemId,
                    projectId,
                    systemAdmin,
                ) and
                ComponentOwnership.writableComponent(ComponentAppearancesTable.componentId, projectId, systemAdmin)
        }.singleOrNull()

    /** Оформление, которое участник вправе читать, либо `null`. */
    fun readableAppearance(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ResultRow? =
        ComponentAppearancesTable.selectAll().where {
            (ComponentAppearancesTable.id eq id) and
                ComponentOwnership.readableDesignSystem(
                    ComponentAppearancesTable.designSystemId,
                    projectId,
                    systemAdmin,
                ) and
                ComponentOwnership.readableComponent(ComponentAppearancesTable.componentId, projectId, systemAdmin)
        }.singleOrNull()

    /** Технические редакции сущностей типа [type] в черновике либо в версии [versionId]. */
    fun revisions(designSystemId: UUID, versionId: UUID?, type: String, ids: Collection<UUID>): Map<UUID, Long> {
        if (ids.isEmpty()) return emptyMap()
        val boundary = versionId ?: ComponentVersionBoundariesTable.selectAll().where {
            (ComponentVersionBoundariesTable.designSystemId eq designSystemId) and
                (ComponentVersionBoundariesTable.status eq ComponentVersionBoundaryStatus.DRAFT)
        }.single()[ComponentVersionBoundariesTable.id]
        return EntityEditStatesTable.selectAll().where {
            (EntityEditStatesTable.designSystemVersionId eq boundary) and
                (EntityEditStatesTable.entityType eq type) and
                (EntityEditStatesTable.entityId inList ids.toList())
        }.associate { it[EntityEditStatesTable.entityId] to it[EntityEditStatesTable.revision] }
    }

    /** Имя без регистра и разделителей: так состояния сопоставляются в конфигурациях. */
    fun canonical(name: String): String = name.lowercase().filter(Char::isLetterOrDigit)

    /** Имена состояний наборов, упорядоченные по имени. */
    fun stateNames(setIds: Collection<UUID>): Map<UUID, List<String>> {
        if (setIds.isEmpty()) return emptyMap()
        val sets = ComponentStateSetsTable.selectAll().where { ComponentStateSetsTable.id inList setIds.toList() }
            .associate { it[ComponentStateSetsTable.id] to it[ComponentStateSetsTable.stateIds] }
        val names = ComponentStatesTable.selectAll()
            .where { ComponentStatesTable.id inList sets.values.flatten().distinct() }
            .associate { it[ComponentStatesTable.id] to it[ComponentStatesTable.name] }
        return sets.mapValues { (_, ids) -> ids.mapNotNull(names::get).sorted() }
    }

    /** Идентификатор набора без состояний; создаёт набор при отсутствии. */
    suspend fun emptyStateSet(states: StateRepository): UUID = resolveStateSet(states, emptyList())

    /** Разрешает набор состояний по именам: состояния взаимодействия и состояния компонента. */
    suspend fun resolveStateSet(states: StateRepository, ids: List<UUID>): UUID =
        when (val resolution = states.resolve(ids)) {
            is StateRepository.Resolution.Success -> resolution.value.value.id
            is StateRepository.Resolution.Invalid ->
                throw EditorRuleViolationException("unknown_state", resolution.reason)
        }

    /** Идентификаторы состояний по именам; неизвестное имя отклоняется кодом `unknown_state`. */
    fun stateIds(componentId: UUID, names: List<String>): List<UUID> {
        if (names.isEmpty()) return emptyList()
        val available = ComponentStatesTable.selectAll().where {
            ComponentStatesTable.componentId.isNull() or (ComponentStatesTable.componentId eq componentId)
        }.toList()
        return names.map { name ->
            available.firstOrNull { canonical(it[ComponentStatesTable.name]) == canonical(name) }
                ?.get(ComponentStatesTable.id)
                ?: throw EditorRuleViolationException("unknown_state", "State '$name' is not declared")
        }.distinct().sorted()
    }

    /** Стили, объявленные в осях оформления, с идентификатором оси. */
    fun styleAxes(appearanceId: UUID): Map<UUID, UUID> =
        AppearanceVariationValuesTable.innerJoin(AppearanceVariationsTable).selectAll()
            .where { AppearanceVariationsTable.appearanceId eq appearanceId }
            .associate { it[AppearanceVariationValuesTable.styleId] to it[AppearanceVariationsTable.id] }

    /** Ключ сочетания: идентификаторы стилей в порядке UUID через запятую, как у импорта и начального заполнения. */
    fun combinationKey(styleIds: Collection<UUID>): String = styleIds.sorted().joinToString(",")
}
