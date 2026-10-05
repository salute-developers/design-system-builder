package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.domain.DesignSystemChange
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import java.util.UUID

/** Project-scoped persistence port for change entries. */
interface DesignSystemChangeRepository {
    /** Performs the list operation. */
    suspend fun list(projectId: ProjectId): List<DesignSystemChange>

    /** Performs the find operation. */
    suspend fun find(projectId: ProjectId, id: UUID): DesignSystemChange?

    /** Performs the listbydesignsystem operation. */
    suspend fun listByDesignSystem(projectId: ProjectId, designSystemId: DesignSystemId): List<DesignSystemChange>?

    /** Performs the create operation. */
    suspend fun create(projectId: ProjectId, command: CreateDesignSystemChange): DesignSystemChange?
}
