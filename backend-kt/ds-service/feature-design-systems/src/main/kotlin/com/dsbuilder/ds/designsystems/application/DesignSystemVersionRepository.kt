package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion
import java.util.UUID

/** Project-scoped persistence port for versions. */
interface DesignSystemVersionRepository {
    /** Performs the list operation. */
    suspend fun list(projectId: ProjectId): List<DesignSystemVersion>

    /** Performs the find operation. */
    suspend fun find(projectId: ProjectId, id: UUID): DesignSystemVersion?

    /** Performs the listbydesignsystem operation. */
    suspend fun listByDesignSystem(projectId: ProjectId, designSystemId: DesignSystemId): List<DesignSystemVersion>?

    /** Performs the create operation. */
    suspend fun create(projectId: ProjectId, command: CreateDesignSystemVersion): DesignSystemVersion?

    /** Performs the update operation. */
    suspend fun update(projectId: ProjectId, id: UUID, command: UpdateDesignSystemVersion): DesignSystemVersion?

    /** Performs the delete operation. */
    suspend fun delete(projectId: ProjectId, id: UUID): Boolean
}
