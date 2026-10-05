package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentReuseConfig
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Persistence port for project-scoped dependency reuse configuration. */
interface ComponentReuseConfigRepository {
    /** Performs the list accessible operation. */
    suspend fun listAccessible(projectId: ProjectId, systemAdmin: Boolean): List<ComponentReuseConfig>

    /** Performs the list by dependency operation. */
    suspend fun listByDependency(projectId: ProjectId, systemAdmin: Boolean, dependencyId: UUID):
        List<ComponentReuseConfig>?

    /** Performs the find accessible operation. */
    suspend fun findAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ComponentReuseConfig?

    /** Performs the create accessible operation. */
    suspend fun createAccessible(projectId: ProjectId, systemAdmin: Boolean, command: Create): ComponentReuseConfig?

    /** Performs the update accessible operation. */
    suspend fun updateAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID, command: Update):
        ComponentReuseConfig?

    /** Performs the delete accessible operation. */
    suspend fun deleteAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Validated reuse configuration creation fields. */
    data class Create(
        /** Component dep id carried by this contract. */
        val componentDepId: UUID,
        /** Design system id carried by this contract. */
        val designSystemId: UUID,
        /** Appearance id carried by this contract. */
        val appearanceId: UUID,
        /** Variation id carried by this contract. */
        val variationId: UUID,
        /** Style id carried by this contract. */
        val styleId: UUID,
    )

    /** Validated reuse configuration patch fields. */
    data class Update(
        /** Appearance id carried by this contract. */
        val appearanceId: UUID?,
        /** Variation id carried by this contract. */
        val variationId: UUID?,
        /** Style id carried by this contract. */
        val styleId: UUID?,
    )
}
