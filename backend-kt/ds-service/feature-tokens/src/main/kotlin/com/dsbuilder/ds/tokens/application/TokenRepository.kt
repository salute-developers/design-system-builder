package com.dsbuilder.ds.tokens.application

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.tokens.domain.Token
import com.dsbuilder.ds.tokens.domain.TokenValue
import java.util.UUID

/** Project-scoped storage contract for tokens and their nested values. */
interface TokenRepository {
    /** Performs the listAccessible operation. */
    suspend fun listAccessible(projectId: ProjectId): List<Token>

    /** Performs the findAccessible operation. */
    suspend fun findAccessible(projectId: ProjectId, id: UUID): Token?

    /** Performs the createOwned operation. */
    suspend fun createOwned(projectId: ProjectId, command: CreateToken): Token?

    /** Performs the updateOwned operation. */
    suspend fun updateOwned(projectId: ProjectId, id: UUID, command: UpdateToken): Token?

    /** Performs the deleteOwned operation. */
    suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean

    /** Performs the values operation. */
    suspend fun values(projectId: ProjectId, id: UUID, filter: TokenValueFilter): List<TokenValue>?
}
