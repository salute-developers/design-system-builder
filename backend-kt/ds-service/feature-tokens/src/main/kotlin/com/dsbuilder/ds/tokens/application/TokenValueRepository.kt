package com.dsbuilder.ds.tokens.application

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.tokens.domain.TokenValue
import java.util.UUID

/** Project-scoped storage contract for direct token-value operations. */
interface TokenValueRepository {
    /** Performs the listAccessible operation. */
    suspend fun listAccessible(projectId: ProjectId): List<TokenValue>

    /** Performs the findAccessible operation. */
    suspend fun findAccessible(projectId: ProjectId, id: UUID): TokenValue?

    /** Performs the createOwned operation. */
    suspend fun createOwned(projectId: ProjectId, command: CreateTokenValue): TokenValue?

    /** Creates an unscoped legacy-compatible value for a trusted system administrator. */
    suspend fun createSystemAdmin(command: CreateTokenValue): TokenValue

    /** Performs the updateOwned operation. */
    suspend fun updateOwned(projectId: ProjectId, id: UUID, command: UpdateTokenValue): TokenValue?

    /** Performs the deleteOwned operation. */
    suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean
}
