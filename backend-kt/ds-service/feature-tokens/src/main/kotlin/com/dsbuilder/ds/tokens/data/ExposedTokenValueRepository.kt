package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.tokens.application.CreateTokenValue
import com.dsbuilder.ds.tokens.application.TokenValueRepository
import com.dsbuilder.ds.tokens.application.UpdateTokenValue
import com.dsbuilder.ds.tokens.domain.TokenValue
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.UUID

/** Exposed token-value repository scoped through its token and design system. */
class ExposedTokenValueRepository : TokenValueRepository {
    override suspend fun listAccessible(projectId: ProjectId): List<TokenValue> = scoped(projectId)
        .map(TokenValueRowMapper::map)

    override suspend fun findAccessible(projectId: ProjectId, id: UUID): TokenValue? = TokenValuesTable
        .innerJoin(TokensTable)
        .innerJoin(TokenDesignSystemsTable)
        .selectAll()
        .where {
            (TokenValuesTable.id eq id) and
                (TokenDesignSystemsTable.projectId eq projectId.value)
        }
        .limit(1)
        .singleOrNull()
        ?.let(TokenValueRowMapper::map)

    override suspend fun createOwned(projectId: ProjectId, command: CreateTokenValue): TokenValue? {
        val tokenId = command.tokenId
        val designSystemId = tokenId?.let { ownedTokenDesignSystem(projectId, it) }
        val referencesValid = designSystemId?.let {
            validTenant(command.tenantId, it) && validPalette(command.paletteId)
        } == true
        if (tokenId == null || !referencesValid) {
            return null
        }
        return insert(command)
    }

    override suspend fun createSystemAdmin(command: CreateTokenValue): TokenValue = insert(command)

    private fun insert(command: CreateTokenValue): TokenValue = TokenValuesTable.insertReturning {
        it[TokenValuesTable.tokenId] = command.tokenId
        it[tenantId] = command.tenantId
        it[paletteId] = command.paletteId
        it[platform] = command.platform
        it[mode] = command.mode
        it[value] = command.value
    }.single().let(TokenValueRowMapper::map)

    override suspend fun updateOwned(
        projectId: ProjectId,
        id: UUID,
        command: UpdateTokenValue,
    ): TokenValue? {
        if (!ownedValue(projectId, id)) return null
        if (command.paletteIdPresent && !validPalette(command.paletteId)) return null
        return TokenValuesTable.updateReturning(where = { TokenValuesTable.id eq id }) {
            if (command.paletteIdPresent) it[paletteId] = command.paletteId
            if (command.platformPresent) it[platform] = command.platform
            if (command.modePresent) it[mode] = command.mode
            if (command.valuePresent) it[value] = command.value
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(TokenValueRowMapper::map)
    }

    override suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean =
        ownedValue(projectId, id) && TokenValuesTable.deleteWhere { TokenValuesTable.id eq id } > 0

    private fun scoped(projectId: ProjectId) = TokenValuesTable
        .innerJoin(TokensTable)
        .innerJoin(TokenDesignSystemsTable)
        .selectAll()
        .where { TokenDesignSystemsTable.projectId eq projectId.value }

    private fun ownedTokenDesignSystem(projectId: ProjectId, id: UUID): UUID? = TokensTable
        .innerJoin(TokenDesignSystemsTable)
        .selectAll()
        .where { (TokensTable.id eq id) and (TokenDesignSystemsTable.projectId eq projectId.value) }
        .limit(1)
        .singleOrNull()
        ?.get(TokensTable.designSystemId)

    private fun validTenant(id: UUID?, designSystemId: UUID): Boolean = id == null || TokenTenantsTable
        .selectAll()
        .where { (TokenTenantsTable.id eq id) and (TokenTenantsTable.designSystemId eq designSystemId) }
        .limit(1)
        .any()

    private fun validPalette(id: UUID?): Boolean = id == null || PaletteTable.selectAll()
        .where { PaletteTable.id eq id }
        .limit(1)
        .any()

    private fun ownedValue(projectId: ProjectId, id: UUID): Boolean = TokenValuesTable
        .innerJoin(TokensTable)
        .innerJoin(TokenDesignSystemsTable)
        .selectAll()
        .where {
            (TokenValuesTable.id eq id) and
                (TokenDesignSystemsTable.projectId eq projectId.value)
        }
        .limit(1)
        .any()
}
