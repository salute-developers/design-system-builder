package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.Component
import com.dsbuilder.ds.components.domain.ComponentDependencyGraph
import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Persistence port for component catalog operations. */
interface ComponentRepository {
    /** Performs the list accessible operation. */
    suspend fun listAccessible(projectId: ProjectId, systemAdmin: Boolean): List<Component>

    /** Performs the find accessible operation. */
    suspend fun findAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Component?

    /** Performs the create global operation. */
    suspend fun createGlobal(command: Create): Component

    /** Performs the update accessible operation. */
    suspend fun updateAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID, command: Update): Component?

    /** Performs the delete accessible operation. */
    suspend fun deleteAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Performs the variations operation. */
    suspend fun variations(projectId: ProjectId, systemAdmin: Boolean, id: UUID): List<ComponentVariationSummary>?

    /** Performs the properties operation. */
    suspend fun properties(projectId: ProjectId, systemAdmin: Boolean, id: UUID): List<ComponentPropertySummary>?

    /** Performs the dependencies operation. */
    suspend fun dependencies(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ComponentDependencyGraph?

    /** Validated component creation fields. */
    data class Create(
        /** Name carried by this contract. */
        val name: String,
        /** Description carried by this contract. */
        val description: String?,
    )

    /** Validated component patch fields. */
    data class Update(
        /** Name carried by this contract. */
        val name: String?,
        /** Description carried by this contract. */
        val description: String?,
        /** Description present carried by this contract. */
        val descriptionPresent: Boolean,
    )
}
