package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ComponentReuseConfigRepository
import com.dsbuilder.ds.components.domain.ComponentReuseConfig
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Exposed repository for design-system-specific dependency reuse configuration. */
class ExposedComponentReuseConfigRepository : ComponentReuseConfigRepository {
    override suspend fun listAccessible(projectId: ProjectId, systemAdmin: Boolean): List<ComponentReuseConfig> {
        if (systemAdmin) return ComponentReuseConfigsTable.selectAll().map(::reuseConfig)
        val designSystemIds = readableDesignSystemIds(projectId)
        if (designSystemIds.isEmpty()) return emptyList()
        return ComponentReuseConfigsTable.selectAll()
            .where { ComponentReuseConfigsTable.designSystemId inList designSystemIds }
            .map(::reuseConfig)
    }

    override suspend fun listByDependency(
        projectId: ProjectId,
        systemAdmin: Boolean,
        dependencyId: UUID,
    ): List<ComponentReuseConfig>? {
        if (!ComponentOwnership.canReadDependency(projectId, systemAdmin, dependencyId)) return null
        return listAccessible(projectId, systemAdmin).filter { it.componentDepId == dependencyId }
    }

    override suspend fun findAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): ComponentReuseConfig? {
        val row = ComponentReuseConfigsTable.selectAll()
            .where { ComponentReuseConfigsTable.id eq id }
            .singleOrNull() ?: return null
        val designSystemId = row[ComponentReuseConfigsTable.designSystemId]
        if (!ComponentOwnership.canReadDesignSystem(projectId, systemAdmin, designSystemId)) {
            return null
        }
        return reuseConfig(row)
    }

    @Suppress("ReturnCount")
    override suspend fun createAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: ComponentReuseConfigRepository.Create,
    ): ComponentReuseConfig? {
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, command.designSystemId)) return null
        if (!ComponentOwnership.canWriteDependency(projectId, systemAdmin, command.componentDepId)) return null
        if (
            !referencesBelongToDesignSystem(
                command.designSystemId,
                command.appearanceId,
                command.variationId,
                command.styleId,
            )
        ) {
            return null
        }
        val id = StableComponentReuseConfigsTable.insertReturning {
            it[componentDepId] = command.componentDepId
            it[designSystemId] = command.designSystemId
        }.single()[StableComponentReuseConfigsTable.id]
        ComponentReuseConfigRevisionsTable.replaceRevision(
            ComponentReuseConfigRevisionsTable.entityId,
            id,
            command.designSystemId,
        ) {
            it[appearanceId] = command.appearanceId
            it[variationId] = command.variationId
            it[styleId] = command.styleId
        }
        return ComponentReuseConfigsTable.selectAll().where { ComponentReuseConfigsTable.id eq id }
            .single().let(::reuseConfig)
    }

    @Suppress("ReturnCount")
    override suspend fun updateAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ComponentReuseConfigRepository.Update,
    ): ComponentReuseConfig? {
        if (!lockComponentSubject(
                StableComponentReuseConfigsTable,
                StableComponentReuseConfigsTable.id,
                StableComponentReuseConfigsTable.designSystemId,
                "component-reuse-config",
                id,
            )
        ) {
            return null
        }
        val current = findAccessible(projectId, systemAdmin, id) ?: return null
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, current.designSystemId)) return null
        val appearanceId = command.appearanceId ?: current.appearanceId
        val variationId = command.variationId ?: current.variationId
        val styleId = command.styleId ?: current.styleId
        if (!referencesBelongToDesignSystem(current.designSystemId, appearanceId, variationId, styleId)) return null
        val changedPaths = buildSet {
            if (command.appearanceId != null) add("/appearance_id")
            if (command.variationId != null) add("/variation_id")
            if (command.styleId != null) add("/style_id")
        }
        if (changedPaths.isEmpty()) return current
        ComponentReuseConfigRevisionsTable.replaceRevision(
            ComponentReuseConfigRevisionsTable.entityId,
            id,
            current.designSystemId,
            changedPaths = changedPaths,
        ) {
            it[ComponentReuseConfigRevisionsTable.appearanceId] = appearanceId
            it[ComponentReuseConfigRevisionsTable.variationId] = variationId
            it[ComponentReuseConfigRevisionsTable.styleId] = styleId
        }
        return ComponentReuseConfigsTable.selectAll().where { ComponentReuseConfigsTable.id eq id }
            .singleOrNull()?.let(::reuseConfig)
    }

    @Suppress("ReturnCount")
    override suspend fun deleteAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!lockComponentSubject(
                StableComponentReuseConfigsTable,
                StableComponentReuseConfigsTable.id,
                StableComponentReuseConfigsTable.designSystemId,
                "component-reuse-config",
                id,
            )
        ) {
            return false
        }
        val current = findAccessible(projectId, systemAdmin, id) ?: return false
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, current.designSystemId)) return false
        ComponentReuseConfigRevisionsTable.replaceRevision(
            ComponentReuseConfigRevisionsTable.entityId,
            id,
            current.designSystemId,
            deleted = true,
        ) {
            it[appearanceId] = current.appearanceId
            it[variationId] = current.variationId
            it[styleId] = current.styleId
        }
        return true
    }
}

internal fun readableDesignSystemIds(projectId: ProjectId): List<UUID> = ComponentDesignSystemsTable.selectAll()
    .where {
        (ComponentDesignSystemsTable.projectId eq projectId.value) or ComponentDesignSystemsTable.projectId.isNull()
    }.map { it[ComponentDesignSystemsTable.id] }

private fun referencesBelongToDesignSystem(
    designSystemId: UUID,
    appearanceId: UUID,
    variationId: UUID,
    styleId: UUID,
): Boolean {
    val appearanceMatches = ComponentAppearancesTable.selectAll().where {
        (ComponentAppearancesTable.id eq appearanceId) and
            (ComponentAppearancesTable.designSystemId eq designSystemId)
    }.limit(1).any()
    val styleMatches = ComponentStylesTable.selectAll().where {
        (ComponentStylesTable.id eq styleId) and
            (ComponentStylesTable.designSystemId eq designSystemId) and
            (ComponentStylesTable.variationId eq variationId)
    }.limit(1).any()
    return appearanceMatches && styleMatches
}

private fun reuseConfig(row: ResultRow) = ComponentReuseConfig(
    row[ComponentReuseConfigsTable.id],
    row[ComponentReuseConfigsTable.componentDepId],
    row[ComponentReuseConfigsTable.designSystemId],
    row[ComponentReuseConfigsTable.appearanceId],
    row[ComponentReuseConfigsTable.variationId],
    row[ComponentReuseConfigsTable.styleId],
    row[ComponentReuseConfigsTable.createdAt],
    row[ComponentReuseConfigsTable.updatedAt],
)
