@file:Suppress("TrailingCommaOnCallSite")

package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.StyleRepository
import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Exposed style repository with design-system and variation ownership checks. */
class ExposedStyleRepository : StyleRepository {
    override suspend fun listAccessible(projectId: ProjectId, systemAdmin: Boolean): List<ComponentStyleSummary> =
        ComponentStylesTable.selectAll().where {
            ComponentOwnership.readableDesignSystem(ComponentStylesTable.designSystemId, projectId, systemAdmin) and
                ComponentOwnership.readableVariation(ComponentStylesTable.variationId, projectId, systemAdmin)
        }.map(::styleModel)

    override suspend fun findAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): ComponentStyleSummary? = ComponentStylesTable.selectAll().where {
        (ComponentStylesTable.id eq id) and
            ComponentOwnership.readableDesignSystem(ComponentStylesTable.designSystemId, projectId, systemAdmin) and
            ComponentOwnership.readableVariation(ComponentStylesTable.variationId, projectId, systemAdmin)
    }.singleOrNull()?.let(::styleModel)

    override suspend fun nameExists(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
        variationId: UUID,
        normalizedName: String,
        excludingId: UUID?,
    ): Boolean = ComponentStylesTable.selectAll().where {
        (ComponentStylesTable.designSystemId eq designSystemId) and
            (ComponentStylesTable.variationId eq variationId) and
            ComponentOwnership.readableDesignSystem(ComponentStylesTable.designSystemId, projectId, systemAdmin)
    }.any { row ->
        row[ComponentStylesTable.id] != excludingId &&
            row[ComponentStylesTable.name].trim().lowercase() == normalizedName
    }

    override suspend fun listByVariationAndDesignSystem(
        projectId: ProjectId,
        systemAdmin: Boolean,
        variationId: UUID,
        designSystemId: UUID,
    ): List<ComponentStyleSummary>? {
        return ComponentStylesTable.selectAll().where {
            (ComponentStylesTable.variationId eq variationId) and
                (ComponentStylesTable.designSystemId eq designSystemId) and
                ComponentOwnership.readableDesignSystem(ComponentStylesTable.designSystemId, projectId, systemAdmin) and
                ComponentOwnership.readableVariation(ComponentStylesTable.variationId, projectId, systemAdmin)
        }.map(::styleModel)
    }

    override suspend fun createAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: StyleRepository.Create,
    ): ComponentStyleSummary? {
        if (!canWrite(projectId, systemAdmin, command.designSystemId, command.variationId)) return null
        val id = StableStylesTable.insertReturning {
            it[designSystemId] = command.designSystemId
            it[variationId] = command.variationId
        }.single()[StableStylesTable.id]
        StyleRevisionsTable.replaceRevision(StyleRevisionsTable.entityId, id, command.designSystemId) {
            it[name] = command.name
            it[description] = command.description
        }
        return requireNotNull(styleRow(id)).let(::styleModel)
    }

    @Suppress("ReturnCount")
    override suspend fun updateAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: StyleRepository.Update,
    ): ComponentStyleSummary? {
        if (!lockComponentSubject(
                StableStylesTable,
                StableStylesTable.id,
                StableStylesTable.designSystemId,
                "style",
                id,
            )
        ) {
            return null
        }
        val current = ComponentStylesTable.selectAll().where {
            (ComponentStylesTable.id eq id) and
                ComponentOwnership.writableDesignSystem(ComponentStylesTable.designSystemId, projectId, systemAdmin) and
                ComponentOwnership.writableVariation(ComponentStylesTable.variationId, projectId, systemAdmin)
        }.singleOrNull() ?: return null
        val changedPaths = buildSet {
            if (command.name != null) add("/name")
            if (command.descriptionPresent) add("/description")
        }
        if (changedPaths.isEmpty()) return styleModel(current)
        StyleRevisionsTable.replaceRevision(
            StyleRevisionsTable.entityId,
            id,
            current[ComponentStylesTable.designSystemId],
            changedPaths = changedPaths,
        ) {
            it[name] = command.name ?: current[ComponentStylesTable.name]
            it[description] = if (command.descriptionPresent) {
                command.description
            } else {
                current[ComponentStylesTable.description]
            }
        }
        return styleRow(id)?.let(::styleModel)
    }

    override suspend fun deleteAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!lockComponentSubject(
                StableStylesTable,
                StableStylesTable.id,
                StableStylesTable.designSystemId,
                "style",
                id,
            )
        ) {
            return false
        }
        val current = ComponentStylesTable.selectAll().where {
            (ComponentStylesTable.id eq id) and
                ComponentOwnership.writableDesignSystem(ComponentStylesTable.designSystemId, projectId, systemAdmin) and
                ComponentOwnership.writableVariation(ComponentStylesTable.variationId, projectId, systemAdmin)
        }.singleOrNull() ?: return false
        StyleRevisionsTable.replaceRevision(
            StyleRevisionsTable.entityId,
            id,
            current[ComponentStylesTable.designSystemId],
            deleted = true,
        ) {
            it[name] = current[ComponentStylesTable.name]
            it[description] = current[ComponentStylesTable.description]
        }
        return true
    }
}

internal fun styleRow(id: UUID) = ComponentStylesTable.selectAll()
    .where { ComponentStylesTable.id eq id }
    .singleOrNull()

internal fun styleModel(row: ResultRow) = ComponentStyleSummary(
    row[ComponentStylesTable.id],
    row[ComponentStylesTable.designSystemId],
    row[ComponentStylesTable.variationId],
    row[ComponentStylesTable.name],
    row[ComponentStylesTable.description],
    row[ComponentStylesTable.createdAt],
    row[ComponentStylesTable.updatedAt],
)

private fun canWrite(projectId: ProjectId, systemAdmin: Boolean, designSystemId: UUID, variationId: UUID): Boolean =
    ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, designSystemId) &&
        ComponentOwnership.canWriteVariation(projectId, systemAdmin, variationId)
