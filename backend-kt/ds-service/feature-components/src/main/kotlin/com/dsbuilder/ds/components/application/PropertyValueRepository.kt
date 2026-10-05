package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.InvariantPropertyValue
import com.dsbuilder.ds.components.domain.VariationPropertyValue
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Persistence port for variation and invariant property values. */
@Suppress("TooManyFunctions")
interface PropertyValueRepository {
    /** Performs the list variation operation. */
    suspend fun listVariation(projectId: ProjectId, systemAdmin: Boolean): List<VariationPropertyValue>

    /** Performs the find variation operation. */
    suspend fun findVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): VariationPropertyValue?

    /** Performs the list variation by style operation. */
    suspend fun listVariationByStyle(
        projectId: ProjectId,
        systemAdmin: Boolean,
        styleId: UUID,
    ): List<VariationPropertyValue>?

    /** Performs the list variation by appearance operation. */
    suspend fun listVariationByAppearance(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
    ): List<VariationPropertyValue>?

    /** Performs the create variation operation. */
    suspend fun createVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: VariationCreate,
    ): VariationPropertyValue?

    /** Performs the update variation operation. */
    suspend fun updateVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ValueUpdate,
    ): VariationPropertyValue?

    /** Performs the delete variation operation. */
    suspend fun deleteVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Performs the list invariant operation. */
    suspend fun listInvariant(projectId: ProjectId, systemAdmin: Boolean): List<InvariantPropertyValue>

    /** Performs the find invariant operation. */
    suspend fun findInvariant(projectId: ProjectId, systemAdmin: Boolean, id: UUID): InvariantPropertyValue?

    /** Performs the list invariant by component and design system operation. */
    suspend fun listInvariantByComponentAndDesignSystem(
        projectId: ProjectId,
        systemAdmin: Boolean,
        componentId: UUID,
        designSystemId: UUID,
    ): List<InvariantPropertyValue>?

    /** Performs the create invariant operation. */
    suspend fun createInvariant(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: InvariantCreate,
    ): InvariantPropertyValue?

    /** Performs the update invariant operation. */
    suspend fun updateInvariant(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ValueUpdate,
    ): InvariantPropertyValue?

    /** Performs the delete invariant operation. */
    suspend fun deleteInvariant(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Public model for variation create. */
    data class VariationCreate(
        /** Property id carried by this contract. */
        val propertyId: UUID,
        /** Style id carried by this contract. */
        val styleId: UUID,
        /** Appearance id carried by this contract. */
        val appearanceId: UUID,
        /** Token id carried by this contract. */
        val tokenId: UUID?,
        /** Value carried by this contract. */
        val value: String?,
        /** Alpha carried by this contract. */
        val alpha: String?,
        /** Adjustment carried by this contract. */
        val adjustment: String?,
        /** State set id carried by this contract. */
        val stateSetId: UUID,
    )

    /** Public model for invariant create. */
    data class InvariantCreate(
        /** Property id carried by this contract. */
        val propertyId: UUID,
        /** Design system id carried by this contract. */
        val designSystemId: UUID,
        /** Component id carried by this contract. */
        val componentId: UUID,
        /** Appearance id carried by this contract. */
        val appearanceId: UUID,
        /** Token id carried by this contract. */
        val tokenId: UUID?,
        /** Value carried by this contract. */
        val value: String?,
        /** Alpha carried by this contract. */
        val alpha: String?,
        /** Adjustment carried by this contract. */
        val adjustment: String?,
        /** State set id carried by this contract. */
        val stateSetId: UUID,
    )

    /** Public model for value update. */
    data class ValueUpdate(
        /** Token id carried by this contract. */
        val tokenId: UUID?,
        /** Token id present carried by this contract. */
        val tokenIdPresent: Boolean,
        /** Value carried by this contract. */
        val value: String?,
        /** Value present carried by this contract. */
        val valuePresent: Boolean,
        /** Alpha carried by this contract. */
        val alpha: String?,
        /** Alpha present carried by this contract. */
        val alphaPresent: Boolean,
        /** Adjustment carried by this contract. */
        val adjustment: String?,
        /** Adjustment present carried by this contract. */
        val adjustmentPresent: Boolean,
        /** State set id carried by this contract. */
        val stateSetId: UUID?,
    )
}
