@file:Suppress("TrailingCommaOnCallSite")

package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.PropertyValueRepository
import com.dsbuilder.ds.components.domain.InvariantPropertyValue
import com.dsbuilder.ds.components.domain.VariationPropertyValue
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.UUID

/** Exposed persistence for variation and invariant property values. */
@Suppress("TooManyFunctions")
class ExposedPropertyValueRepository : PropertyValueRepository {
    override suspend fun listVariation(projectId: ProjectId, systemAdmin: Boolean): List<VariationPropertyValue> =
        VariationPropertyValuesTable.selectAll().where {
            readableVariationValue(projectId, systemAdmin)
        }.map(::variationPropertyValue)

    override suspend fun findVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): VariationPropertyValue? = VariationPropertyValuesTable.selectAll().where {
        (VariationPropertyValuesTable.id eq id) and readableVariationValue(projectId, systemAdmin)
    }.singleOrNull()?.let(::variationPropertyValue)

    override suspend fun listVariationByStyle(
        projectId: ProjectId,
        systemAdmin: Boolean,
        styleId: UUID,
    ): List<VariationPropertyValue>? {
        return VariationPropertyValuesTable.selectAll().where {
            (VariationPropertyValuesTable.styleId eq styleId) and readableVariationValue(projectId, systemAdmin)
        }.map(::variationPropertyValue)
    }

    override suspend fun listVariationByAppearance(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
    ): List<VariationPropertyValue>? {
        return VariationPropertyValuesTable.selectAll()
            .where {
                (VariationPropertyValuesTable.appearanceId eq appearanceId) and
                    readableVariationValue(projectId, systemAdmin)
            }.map(::variationPropertyValue)
    }

    override suspend fun createVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: PropertyValueRepository.VariationCreate,
    ): VariationPropertyValue? {
        if (!canWriteVariationReferences(projectId, systemAdmin, command)) return null
        return VariationPropertyValuesTable.insertReturning {
            it[propertyId] = command.propertyId
            it[styleId] = command.styleId
            it[appearanceId] = command.appearanceId
            it[tokenId] = command.tokenId
            it[value] = command.value
            it[alpha] = command.alpha
            it[adjustment] = command.adjustment
            it[stateSetId] = command.stateSetId
        }.single().let(::variationPropertyValue)
    }

    @Suppress("ReturnCount")
    override suspend fun updateVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: PropertyValueRepository.ValueUpdate,
    ): VariationPropertyValue? {
        if (command.tokenId != null && !ComponentOwnership.canReadToken(projectId, systemAdmin, command.tokenId)) {
            return null
        }
        if (
            command.stateSetId != null &&
            !ComponentOwnership.canReadStateSet(projectId, systemAdmin, command.stateSetId)
        ) {
            return null
        }
        return VariationPropertyValuesTable.updateReturning(where = {
            (VariationPropertyValuesTable.id eq id) and writableVariationValue(projectId, systemAdmin)
        }) {
            if (command.tokenIdPresent) it[tokenId] = command.tokenId
            if (command.valuePresent) it[value] = command.value
            if (command.alphaPresent) it[alpha] = command.alpha
            if (command.adjustmentPresent) it[adjustment] = command.adjustment
            command.stateSetId?.let { stateSet -> it[stateSetId] = stateSet }
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::variationPropertyValue)
    }

    override suspend fun deleteVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        return VariationPropertyValuesTable.deleteWhere {
            (VariationPropertyValuesTable.id eq id) and writableVariationValue(projectId, systemAdmin)
        } > 0
    }

    override suspend fun listInvariant(projectId: ProjectId, systemAdmin: Boolean): List<InvariantPropertyValue> =
        InvariantPropertyValuesTable.selectAll().where {
            readableInvariantValue(projectId, systemAdmin)
        }.map(::invariantPropertyValue)

    override suspend fun findInvariant(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): InvariantPropertyValue? = InvariantPropertyValuesTable.selectAll().where {
        (InvariantPropertyValuesTable.id eq id) and readableInvariantValue(projectId, systemAdmin)
    }.singleOrNull()?.let(::invariantPropertyValue)

    override suspend fun listInvariantByComponentAndDesignSystem(
        projectId: ProjectId,
        systemAdmin: Boolean,
        componentId: UUID,
        designSystemId: UUID,
    ): List<InvariantPropertyValue>? {
        return InvariantPropertyValuesTable.selectAll().where {
            (InvariantPropertyValuesTable.componentId eq componentId) and
                (InvariantPropertyValuesTable.designSystemId eq designSystemId) and
                readableInvariantValue(projectId, systemAdmin)
        }.map(::invariantPropertyValue)
    }

    override suspend fun createInvariant(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: PropertyValueRepository.InvariantCreate,
    ): InvariantPropertyValue? {
        if (!canWriteInvariantReferences(projectId, systemAdmin, command)) return null
        return InvariantPropertyValuesTable.insertReturning {
            it[propertyId] = command.propertyId
            it[designSystemId] = command.designSystemId
            it[componentId] = command.componentId
            it[appearanceId] = command.appearanceId
            it[tokenId] = command.tokenId
            it[value] = command.value
            it[alpha] = command.alpha
            it[adjustment] = command.adjustment
            it[stateSetId] = command.stateSetId
        }.single().let(::invariantPropertyValue)
    }

    @Suppress("ReturnCount")
    override suspend fun updateInvariant(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: PropertyValueRepository.ValueUpdate,
    ): InvariantPropertyValue? {
        if (command.tokenId != null && !ComponentOwnership.canReadToken(projectId, systemAdmin, command.tokenId)) {
            return null
        }
        if (
            command.stateSetId != null &&
            !ComponentOwnership.canReadStateSet(projectId, systemAdmin, command.stateSetId)
        ) {
            return null
        }
        return InvariantPropertyValuesTable.updateReturning(where = {
            (InvariantPropertyValuesTable.id eq id) and writableInvariantValue(projectId, systemAdmin)
        }) {
            if (command.tokenIdPresent) it[tokenId] = command.tokenId
            if (command.valuePresent) it[value] = command.value
            if (command.alphaPresent) it[alpha] = command.alpha
            if (command.adjustmentPresent) it[adjustment] = command.adjustment
            command.stateSetId?.let { stateSet -> it[stateSetId] = stateSet }
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::invariantPropertyValue)
    }

    override suspend fun deleteInvariant(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        return InvariantPropertyValuesTable.deleteWhere {
            (InvariantPropertyValuesTable.id eq id) and writableInvariantValue(projectId, systemAdmin)
        } > 0
    }
}

private fun variationPropertyValue(row: ResultRow) = VariationPropertyValue(
    row[VariationPropertyValuesTable.id], row[VariationPropertyValuesTable.propertyId],
    row[VariationPropertyValuesTable.styleId], row[VariationPropertyValuesTable.appearanceId],
    row[VariationPropertyValuesTable.tokenId], row[VariationPropertyValuesTable.value],
    row[VariationPropertyValuesTable.alpha], row[VariationPropertyValuesTable.adjustment],
    row[VariationPropertyValuesTable.position], row[VariationPropertyValuesTable.stateSetId],
    row[VariationPropertyValuesTable.createdAt], row[VariationPropertyValuesTable.updatedAt],
)

private fun invariantPropertyValue(row: ResultRow) = InvariantPropertyValue(
    row[InvariantPropertyValuesTable.id], row[InvariantPropertyValuesTable.propertyId],
    row[InvariantPropertyValuesTable.designSystemId], row[InvariantPropertyValuesTable.componentId],
    row[InvariantPropertyValuesTable.appearanceId], row[InvariantPropertyValuesTable.tokenId],
    row[InvariantPropertyValuesTable.value], row[InvariantPropertyValuesTable.alpha],
    row[InvariantPropertyValuesTable.adjustment], row[InvariantPropertyValuesTable.position],
    row[InvariantPropertyValuesTable.stateSetId], row[InvariantPropertyValuesTable.createdAt],
    row[InvariantPropertyValuesTable.updatedAt],
)

private fun readableVariationValue(projectId: ProjectId, systemAdmin: Boolean) =
    ComponentOwnership.readableProperty(VariationPropertyValuesTable.propertyId, projectId, systemAdmin) and
        ComponentOwnership.readableStyle(VariationPropertyValuesTable.styleId, projectId, systemAdmin) and
        ComponentOwnership.readableAppearance(VariationPropertyValuesTable.appearanceId, projectId, systemAdmin)

private fun writableVariationValue(projectId: ProjectId, systemAdmin: Boolean) =
    ComponentOwnership.writableProperty(VariationPropertyValuesTable.propertyId, projectId, systemAdmin) and
        ComponentOwnership.writableStyle(VariationPropertyValuesTable.styleId, projectId, systemAdmin) and
        ComponentOwnership.writableAppearance(VariationPropertyValuesTable.appearanceId, projectId, systemAdmin)

private fun canWriteVariationReferences(
    projectId: ProjectId,
    systemAdmin: Boolean,
    command: PropertyValueRepository.VariationCreate,
): Boolean = ComponentOwnership.canWriteProperty(projectId, systemAdmin, command.propertyId) &&
    ComponentOwnership.canWriteStyle(projectId, systemAdmin, command.styleId) &&
    ComponentOwnership.canWriteAppearance(projectId, systemAdmin, command.appearanceId) &&
    ComponentOwnership.canReadStateSet(projectId, systemAdmin, command.stateSetId) &&
    (command.tokenId == null || ComponentOwnership.canReadToken(projectId, systemAdmin, command.tokenId))

private fun readableInvariantValue(projectId: ProjectId, systemAdmin: Boolean) =
    ComponentOwnership.readableProperty(InvariantPropertyValuesTable.propertyId, projectId, systemAdmin) and
        ComponentOwnership.readableDesignSystem(
            InvariantPropertyValuesTable.designSystemId,
            projectId,
            systemAdmin,
        ) and ComponentOwnership.readableComponent(
            InvariantPropertyValuesTable.componentId,
            projectId,
            systemAdmin,
        ) and ComponentOwnership.readableAppearance(
            InvariantPropertyValuesTable.appearanceId,
            projectId,
            systemAdmin,
        )

private fun writableInvariantValue(projectId: ProjectId, systemAdmin: Boolean) =
    ComponentOwnership.writableProperty(InvariantPropertyValuesTable.propertyId, projectId, systemAdmin) and
        ComponentOwnership.writableDesignSystem(
            InvariantPropertyValuesTable.designSystemId,
            projectId,
            systemAdmin,
        ) and ComponentOwnership.writableComponent(
            InvariantPropertyValuesTable.componentId,
            projectId,
            systemAdmin,
        ) and ComponentOwnership.writableAppearance(
            InvariantPropertyValuesTable.appearanceId,
            projectId,
            systemAdmin,
        )

private fun canWriteInvariantReferences(
    projectId: ProjectId,
    systemAdmin: Boolean,
    command: PropertyValueRepository.InvariantCreate,
): Boolean = ComponentOwnership.canWriteProperty(projectId, systemAdmin, command.propertyId) &&
    ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, command.designSystemId) &&
    command.componentId in ComponentOwnership.writableComponentIds(projectId, systemAdmin) &&
    ComponentOwnership.canWriteAppearance(projectId, systemAdmin, command.appearanceId) &&
    ComponentOwnership.canReadStateSet(projectId, systemAdmin, command.stateSetId) &&
    (command.tokenId == null || ComponentOwnership.canReadToken(projectId, systemAdmin, command.tokenId))
