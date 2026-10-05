package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.domain.DesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystemId

/** Project-scoped persistence port for design systems. */
interface DesignSystemRepository {
    /** Performs the listaccessible operation. */
    suspend fun listAccessible(projectId: ProjectId): List<DesignSystem>

    /** Performs the findaccessible operation. */
    suspend fun findAccessible(projectId: ProjectId, id: DesignSystemId): DesignSystem?

    /** Performs the createowned operation. */
    suspend fun createOwned(projectId: ProjectId, command: CreateDesignSystem): DesignSystem

    /** Performs the updateowned operation. */
    suspend fun updateOwned(projectId: ProjectId, id: DesignSystemId, command: UpdateDesignSystem): DesignSystem?

    /** Performs the deleteowned operation. */
    suspend fun deleteOwned(projectId: ProjectId, id: DesignSystemId): Boolean
}
