package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Persistence port for design-system component styles. */
interface StyleRepository {
    /** Performs the list accessible operation. */
    suspend fun listAccessible(projectId: ProjectId, systemAdmin: Boolean): List<ComponentStyleSummary>

    /** Performs the find accessible operation. */
    suspend fun findAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ComponentStyleSummary?

    /** Performs the list by variation and design system operation. */
    suspend fun listByVariationAndDesignSystem(
        projectId: ProjectId,
        systemAdmin: Boolean,
        variationId: UUID,
        designSystemId: UUID,
    ): List<ComponentStyleSummary>?

    /** Performs the create accessible operation. */
    suspend fun createAccessible(projectId: ProjectId, systemAdmin: Boolean, command: Create): ComponentStyleSummary?

    /** Performs the update accessible operation. */
    suspend fun updateAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: Update,
    ): ComponentStyleSummary?

    /** Performs the delete accessible operation. */
    suspend fun deleteAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Public model for create. */
    data class Create(
        /** Design system id carried by this contract. */
        val designSystemId: UUID,
        /** Variation id carried by this contract. */
        val variationId: UUID,
        /** Name carried by this contract. */
        val name: String,
        /** Description carried by this contract. */
        val description: String?,
    )

    /** Public model for update. */
    data class Update(
        /** Name carried by this contract. */
        val name: String?,
        /** Description carried by this contract. */
        val description: String?,
        /** Description present carried by this contract. */
        val descriptionPresent: Boolean,
    )
}
