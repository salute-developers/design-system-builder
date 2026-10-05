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
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
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
        return ComponentReuseConfigsTable.insertReturning {
            it[componentDepId] = command.componentDepId
            it[designSystemId] = command.designSystemId
            it[appearanceId] = command.appearanceId
            it[variationId] = command.variationId
            it[styleId] = command.styleId
        }.single().let(::reuseConfig)
    }

    @Suppress("ReturnCount")
    override suspend fun updateAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ComponentReuseConfigRepository.Update,
    ): ComponentReuseConfig? {
        val current = findAccessible(projectId, systemAdmin, id) ?: return null
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, current.designSystemId)) return null
        val appearanceId = command.appearanceId ?: current.appearanceId
        val variationId = command.variationId ?: current.variationId
        val styleId = command.styleId ?: current.styleId
        if (!referencesBelongToDesignSystem(current.designSystemId, appearanceId, variationId, styleId)) return null
        return ComponentReuseConfigsTable.updateReturning(where = { ComponentReuseConfigsTable.id eq id }) {
            command.appearanceId?.let { value -> it[ComponentReuseConfigsTable.appearanceId] = value }
            command.variationId?.let { value -> it[ComponentReuseConfigsTable.variationId] = value }
            command.styleId?.let { value -> it[ComponentReuseConfigsTable.styleId] = value }
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::reuseConfig)
    }

    override suspend fun deleteAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        val current = findAccessible(projectId, systemAdmin, id) ?: return false
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, current.designSystemId)) return false
        return ComponentReuseConfigsTable.deleteWhere { ComponentReuseConfigsTable.id eq id } > 0
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
