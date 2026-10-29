package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentState
import com.dsbuilder.ds.components.domain.ComponentStateSet
import com.dsbuilder.ds.components.domain.ResolvedStateSet
import com.dsbuilder.ds.components.domain.StateImpact
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Persistence port for states and canonical state sets. */
interface StateRepository {
    /** Performs the list operation. */
    suspend fun list(
        projectId: ProjectId,
        systemAdmin: Boolean,
        componentId: UUID?,
        componentFilterPresent: Boolean,
    ): List<ComponentState>

    /** Performs the find operation. */
    suspend fun find(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ComponentState?

    /** Performs the impact operation. */
    suspend fun impact(projectId: ProjectId, systemAdmin: Boolean, id: UUID): StateImpact?

    /** Performs the create operation. */
    suspend fun create(command: Create): ComponentState

    /** Performs the update operation. */
    suspend fun update(id: UUID, command: Update): ComponentState?

    /** Performs the delete operation. */
    suspend fun delete(id: UUID): Boolean

    /** Performs the list sets operation. */
    suspend fun listSets(projectId: ProjectId, systemAdmin: Boolean): List<ComponentStateSet>

    /** Performs the find set operation. */
    suspend fun findSet(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ComponentStateSet?

    /** Performs the resolve operation. */
    suspend fun resolve(stateIds: List<UUID>): Resolution

    /** Public model for create. */
    data class Create(
        /** Component id carried by this contract. */
        val componentId: UUID?,
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

    /** Public model for resolution. */
    sealed interface Resolution {
        /** Public model for success. */
        data class Success(/** Value carried by this contract. */ val value: ResolvedStateSet) : Resolution

        /** Public model for invalid. */
        data class Invalid(/** Reason carried by this contract. */ val reason: String) : Resolution
    }
}
