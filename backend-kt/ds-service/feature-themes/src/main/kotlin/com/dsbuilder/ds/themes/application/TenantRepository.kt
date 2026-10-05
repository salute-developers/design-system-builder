package com.dsbuilder.ds.themes.application

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.Tenant
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import java.util.UUID

/** Project-scoped persistence port for themes. */
interface TenantRepository {
    /** Performs the listaccessible operation. */
    suspend fun listAccessible(projectId: ProjectId): List<Tenant>

    /** Performs the findaccessible operation. */
    suspend fun findAccessible(projectId: ProjectId, id: UUID): Tenant?

    /** Performs the createowned operation. */
    suspend fun createOwned(projectId: ProjectId, command: CreateTenant): Tenant?

    /** Performs the updateowned operation. */
    suspend fun updateOwned(projectId: ProjectId, id: UUID, command: UpdateTenant): Tenant?

    /** Performs the deleteowned operation. */
    suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean

    /** Performs the tokenvalues operation. */
    suspend fun tokenValues(projectId: ProjectId, id: UUID): List<TenantTokenValue>?

    /** Атомарно заменяет platform-specific значения доступной темы. */
    suspend fun saveTokenValues(
        projectId: ProjectId,
        id: UUID,
        command: SaveTenantTokenValues,
    ): TenantTokenValuesSaveOutcome
}
