package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.tokens.application.CreateToken
import com.dsbuilder.ds.tokens.application.TokenRepository
import com.dsbuilder.ds.tokens.application.TokenValueFilter
import com.dsbuilder.ds.tokens.application.UpdateToken
import com.dsbuilder.ds.tokens.domain.Token
import com.dsbuilder.ds.tokens.domain.TokenValue
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.UUID

/** Exposed token repository with ownership resolved through design systems. */
class ExposedTokenRepository : TokenRepository {
    override suspend fun listAccessible(projectId: ProjectId): List<Token> = accessibleTokens(projectId)
        .map(TokenRowMapper::map)

    override suspend fun findAccessible(projectId: ProjectId, id: UUID): Token? = TokensTable
        .leftJoin(TokenDesignSystemsTable)
        .selectAll()
        .where {
            (TokensTable.id eq id) and
                (
                    TokensTable.designSystemId.isNull() or
                        TokenDesignSystemsTable.projectId.isNull() or
                        (TokenDesignSystemsTable.projectId eq projectId.value)
                    )
        }
        .limit(1)
        .singleOrNull()
        ?.let(TokenRowMapper::map)

    override suspend fun createOwned(projectId: ProjectId, command: CreateToken): Token? {
        if (command.designSystemId != null && !ownedDesignSystem(projectId, command.designSystemId)) return null
        if (command.designSystemId == null) return null
        return TokensTable.insertReturning {
            it[designSystemId] = command.designSystemId
            it[name] = command.name
            it[type] = command.type
            it[displayName] = command.displayName
            it[description] = command.description
            it[enabled] = command.enabled
        }.single().let(TokenRowMapper::map)
    }

    override suspend fun updateOwned(projectId: ProjectId, id: UUID, command: UpdateToken): Token? {
        if (!ownedToken(projectId, id)) return null
        return TokensTable.updateReturning(where = { TokensTable.id eq id }) {
            if (command.namePresent) it[name] = requireNotNull(command.name)
            if (command.typePresent) it[type] = command.type
            if (command.displayNamePresent) it[displayName] = command.displayName
            if (command.descriptionPresent) it[description] = command.description
            if (command.enabledPresent) it[enabled] = command.enabled
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(TokenRowMapper::map)
    }

    override suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean =
        ownedToken(projectId, id) && TokensTable.deleteWhere { TokensTable.id eq id } > 0

    override suspend fun values(
        projectId: ProjectId,
        id: UUID,
        filter: TokenValueFilter,
    ): List<TokenValue>? {
        if (findAccessible(projectId, id) == null) return null
        var condition: Op<Boolean> = TokenValuesTable.tokenId eq id
        filter.tenantId?.let { condition = condition and (TokenValuesTable.tenantId eq it) }
        filter.platform?.let { condition = condition and (TokenValuesTable.platform eq it) }
        filter.mode?.let { condition = condition and (TokenValuesTable.mode eq it) }
        return TokenValuesTable.selectAll().where { condition }.map(TokenValueRowMapper::map)
    }

    private fun accessibleTokens(projectId: ProjectId) = TokensTable
        .leftJoin(TokenDesignSystemsTable)
        .selectAll()
        .where {
            TokensTable.designSystemId.isNull() or
                TokenDesignSystemsTable.projectId.isNull() or
                (TokenDesignSystemsTable.projectId eq projectId.value)
        }

    private fun ownedToken(projectId: ProjectId, id: UUID): Boolean = TokensTable
        .innerJoin(TokenDesignSystemsTable)
        .selectAll()
        .where { (TokensTable.id eq id) and (TokenDesignSystemsTable.projectId eq projectId.value) }
        .limit(1)
        .any()

    private fun ownedDesignSystem(projectId: ProjectId, id: UUID): Boolean = TokenDesignSystemsTable
        .selectAll()
        .where { (TokenDesignSystemsTable.id eq id) and (TokenDesignSystemsTable.projectId eq projectId.value) }
        .limit(1)
        .any()
}
