package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentDependency
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Persistence port for project-scoped component dependencies. */
interface ComponentDependencyRepository {
    /** Performs the list accessible operation. */
    suspend fun listAccessible(projectId: ProjectId, systemAdmin: Boolean): List<ComponentDependency>

    /** Performs the find accessible operation. */
    suspend fun findAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ComponentDependency?

    /** Performs the create accessible operation. */
    suspend fun createAccessible(projectId: ProjectId, systemAdmin: Boolean, command: Create): ComponentDependency?

    /** Performs the update accessible operation. */
    suspend fun updateAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID, command: Update):
        ComponentDependency?

    /** Performs the delete accessible operation. */
    suspend fun deleteAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Validated dependency creation fields. */
    data class Create(
        /** Parent id carried by this contract. */
        val parentId: UUID,
        /** Child id carried by this contract. */
        val childId: UUID,
        /** Type carried by this contract. */
        val type: ComponentDependency.RelationType,
        /** Order carried by this contract. */
        val order: Int?,
    )

    /** Validated dependency patch fields. */
    data class Update(
        /** Type carried by this contract. */
        val type: ComponentDependency.RelationType?,
        /** Order carried by this contract. */
        val order: Int?,
        /** Order present carried by this contract. */
        val orderPresent: Boolean,
    )
}
