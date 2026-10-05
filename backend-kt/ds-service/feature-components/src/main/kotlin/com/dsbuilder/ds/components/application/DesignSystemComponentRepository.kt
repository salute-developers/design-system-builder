package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.DesignSystemComponent
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Persistence port for project-scoped component links. */
interface DesignSystemComponentRepository {
    /** Performs the list accessible operation. */
    suspend fun listAccessible(projectId: ProjectId, systemAdmin: Boolean): List<DesignSystemComponent>

    /** Performs the find accessible operation. */
    suspend fun findAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): DesignSystemComponent?

    /** Performs the create owned operation. */
    suspend fun createOwned(projectId: ProjectId, systemAdmin: Boolean, designSystemId: UUID, componentId: UUID):
        DesignSystemComponent?

    /** Performs the delete owned operation. */
    suspend fun deleteOwned(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean
}
