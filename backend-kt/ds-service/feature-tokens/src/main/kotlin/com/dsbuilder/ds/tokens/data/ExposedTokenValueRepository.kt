package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.latestRevision
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.core.data.selectedVersionBoundary
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.tokens.application.CreateTokenValue
import com.dsbuilder.ds.tokens.application.TokenValueRepository
import com.dsbuilder.ds.tokens.application.UpdateTokenValue
import com.dsbuilder.ds.tokens.domain.TokenValue
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Exposed token-value repository scoped through its token and design system. */
class ExposedTokenValueRepository : TokenValueRepository {
    override suspend fun listAccessible(projectId: ProjectId): List<TokenValue> = currentRows(projectId = projectId)
        .map(TokenValueRowMapper::map)

    override suspend fun findAccessible(projectId: ProjectId, id: UUID): TokenValue? = currentRows(
        projectId = projectId,
        id = id,
    )
        .singleOrNull()
        ?.let(TokenValueRowMapper::map)

    override suspend fun createAllowed(projectId: ProjectId, command: CreateTokenValue): Boolean {
        val designSystemId = command.tokenId?.let { ownedTokenDesignSystem(projectId, it) } ?: return false
        return validTenant(command.tenantId, designSystemId) && validPalette(command.paletteId)
    }

    override suspend fun lockOwned(projectId: ProjectId, id: UUID): Boolean {
        val current = currentRows(projectId = projectId, id = id).singleOrNull()
            ?.takeIf { it[TokenDesignSystemsTable.projectId] == projectId.value }
            ?: return false
        return lockDraftSubject(current[TokenValuesTable.designSystemId], "token-value", id)
    }

    override suspend fun createOwned(projectId: ProjectId, command: CreateTokenValue): TokenValue? =
        if (createAllowed(projectId, command)) insert(command) else null

    override suspend fun createSystemAdmin(command: CreateTokenValue): TokenValue = insert(command)

    private fun insert(command: CreateTokenValue): TokenValue {
        val tokenId = requireNotNull(command.tokenId)
        val token = currentTokenRow(tokenId) ?: error("Token is missing")
        val designSystemId = requireNotNull(token[TokensTable.designSystemId])
        val draft = draft(designSystemId) ?: error("Active draft is missing")
        val tenantId = requireNotNull(command.tenantId)
        val existing = TokenValuesTable.selectAll().where {
            (TokenValuesTable.tokenId eq tokenId) and
                (TokenValuesTable.tenantId eq tenantId) and
                (TokenValuesTable.platform eq command.platform) and
                (TokenValuesTable.mode eq command.mode)
        }.singleOrNull()
        val entity = if (existing != null && resolvedRows(id = existing[TokenValuesTable.id]).singleOrNull()
                ?.get(TokenValueRevisionsTable.deleted) == true
        ) {
            existing
        } else {
            TokenValuesTable.insertReturning {
                it[TokenValuesTable.designSystemId] = designSystemId
                it[TokenValuesTable.tokenId] = tokenId
                it[TokenValuesTable.tenantId] = tenantId
                it[platform] = command.platform
                it[mode] = command.mode
            }.single()
        }
        if (existing != null) {
            TokenValueRevisionsTable.deleteWhere {
                (TokenValueRevisionsTable.tokenValueId eq entity[TokenValuesTable.id]) and
                    (TokenValueRevisionsTable.designSystemVersionId eq draft[TokenVersionBoundariesTable.id])
            }
        }
        SubjectMutationPaths.with(setOf("/palette_id", "/value")) {
            TokenValueRevisionsTable.insert {
                it[tokenValueId] = entity[TokenValuesTable.id]
                it[TokenValueRevisionsTable.designSystemId] = designSystemId
                it[designSystemVersionId] = draft[TokenVersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[TokenVersionBoundariesTable.sequenceNumber]
                it[paletteId] = command.paletteId
                it[value] = command.value
                it[deleted] = false
            }
        }
        return requireNotNull(currentRow(entity[TokenValuesTable.id])).let(TokenValueRowMapper::map)
    }

    @Suppress("CyclomaticComplexMethod", "ReturnCount")
    override suspend fun updateOwned(
        projectId: ProjectId,
        id: UUID,
        command: UpdateTokenValue,
    ): TokenValue? {
        val current = currentRows(projectId = projectId, id = id).singleOrNull()
            ?.takeIf { it[TokenDesignSystemsTable.projectId] == projectId.value }
            ?: return null
        if (command.paletteIdPresent && !validPalette(command.paletteId)) return null
        if (command.platformPresent || command.modePresent) return null
        val designSystemId = current[TokenValuesTable.designSystemId]
        val draft = draft(designSystemId) ?: return null
        if (!lockDraftSubject(designSystemId, "token-value", id)) return null
        val changedPaths = buildSet {
            if (command.paletteIdPresent) add("/palette_id")
            if (command.valuePresent) add("/value")
        }
        if (changedPaths.isEmpty()) return current.let(TokenValueRowMapper::map)
        TokenValueRevisionsTable.deleteWhere {
            (TokenValueRevisionsTable.tokenValueId eq id) and
                (TokenValueRevisionsTable.designSystemVersionId eq draft[TokenVersionBoundariesTable.id])
        }
        SubjectMutationPaths.with(changedPaths) {
            TokenValueRevisionsTable.insert {
                it[tokenValueId] = id
                it[TokenValueRevisionsTable.designSystemId] = designSystemId
                it[designSystemVersionId] = draft[TokenVersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[TokenVersionBoundariesTable.sequenceNumber]
                it[paletteId] = if (command.paletteIdPresent) {
                    command.paletteId
                } else {
                    current[TokenValueRevisionsTable.paletteId]
                }
                it[value] = if (command.valuePresent) command.value else current[TokenValueRevisionsTable.value]
                it[overridden] = current[TokenValueRevisionsTable.overridden]
                it[deleted] = false
            }
        }
        return currentRow(id)?.let(TokenValueRowMapper::map)
    }

    @Suppress("ReturnCount")
    override suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean {
        val current = currentRows(projectId = projectId, id = id).singleOrNull()
            ?.takeIf { it[TokenDesignSystemsTable.projectId] == projectId.value }
            ?: return false
        val draft = draft(current[TokenValuesTable.designSystemId]) ?: return false
        if (!lockDraftSubject(current[TokenValuesTable.designSystemId], "token-value", id)) return false
        TokenValueRevisionsTable.deleteWhere {
            (TokenValueRevisionsTable.tokenValueId eq id) and
                (TokenValueRevisionsTable.designSystemVersionId eq draft[TokenVersionBoundariesTable.id])
        }
        SubjectMutationPaths.with(setOf("/deleted")) {
            TokenValueRevisionsTable.insert {
                it[tokenValueId] = id
                it[designSystemId] = current[TokenValuesTable.designSystemId]
                it[designSystemVersionId] = draft[TokenVersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[TokenVersionBoundariesTable.sequenceNumber]
                it[paletteId] = current[TokenValueRevisionsTable.paletteId]
                it[value] = current[TokenValueRevisionsTable.value]
                it[overridden] = current[TokenValueRevisionsTable.overridden]
                it[deleted] = true
            }
        }
        return true
    }

    private fun ownedTokenDesignSystem(projectId: ProjectId, id: UUID): UUID? = currentTokenRows(projectId, id = id)
        .singleOrNull()
        ?.get(TokensTable.designSystemId)

    private fun validTenant(id: UUID?, designSystemId: UUID): Boolean = id == null ||
        id in currentTenantIds(designSystemId) && TokenTenantsTable
            .selectAll()
            .where { (TokenTenantsTable.id eq id) and (TokenTenantsTable.designSystemId eq designSystemId) }
            .limit(1)
            .any()

    private fun validPalette(id: UUID?): Boolean = id == null || PaletteTable.selectAll()
        .where { PaletteTable.id eq id }
        .limit(1)
        .any()

    private fun currentRows(
        projectId: ProjectId? = null,
        id: UUID? = null,
    ): List<ResultRow> = resolvedRows(projectId, id).filter { !it[TokenValueRevisionsTable.deleted] }
        .let { rows ->
            val designSystemIds = rows.mapTo(hashSetOf()) { it[TokenValuesTable.designSystemId] }
            val tokenIds = designSystemIds.flatMap { currentTokenRows(designSystemId = it) }
                .mapTo(hashSetOf()) { it[TokensTable.id] }
            val tenantIds = designSystemIds.flatMap(::currentTenantIds).toHashSet()
            rows.filter { row ->
                row[TokenValuesTable.tokenId] in tokenIds && row[TokenValuesTable.tenantId] in tenantIds
            }
        }

    private fun resolvedRows(
        projectId: ProjectId? = null,
        id: UUID? = null,
    ): List<ResultRow> = TokenValuesTable
        .join(TokenValueRevisionsTable, JoinType.INNER, TokenValuesTable.id, TokenValueRevisionsTable.tokenValueId)
        .join(TokensTable, JoinType.INNER, TokenValuesTable.tokenId, TokensTable.id)
        .join(TokenDesignSystemsTable, JoinType.INNER, TokensTable.designSystemId, TokenDesignSystemsTable.id)
        .join(
            TokenVersionBoundariesTable,
            JoinType.INNER,
            TokenValueRevisionsTable.designSystemId,
            TokenVersionBoundariesTable.designSystemId,
        )
        .selectAll()
        .where {
            var predicate: Op<Boolean> = selectedVersionBoundary("design_system_versions") and
                (TokenValueRevisionsTable.versionSequenceNumber lessEq TokenVersionBoundariesTable.sequenceNumber) and
                latestRevision("token_value_revisions", "token_value_id")
            projectId?.let { predicate = predicate and (TokenDesignSystemsTable.projectId eq it.value) }
            id?.let { predicate = predicate and (TokenValuesTable.id eq it) }
            predicate
        }
        .toList()

    private fun currentRow(id: UUID) = currentRows(id = id).singleOrNull()

    private fun currentTokenRows(
        projectId: ProjectId? = null,
        designSystemId: UUID? = null,
        id: UUID? = null,
    ): List<ResultRow> = TokensTable
        .join(TokenRevisionsTable, JoinType.INNER, TokensTable.id, TokenRevisionsTable.tokenId)
        .join(TokenDesignSystemsTable, JoinType.INNER, TokensTable.designSystemId, TokenDesignSystemsTable.id)
        .join(
            TokenVersionBoundariesTable,
            JoinType.INNER,
            TokenRevisionsTable.designSystemId,
            TokenVersionBoundariesTable.designSystemId,
        )
        .selectAll()
        .where {
            var predicate: Op<Boolean> = selectedVersionBoundary("design_system_versions") and
                (TokenRevisionsTable.versionSequenceNumber lessEq TokenVersionBoundariesTable.sequenceNumber) and
                latestRevision("token_revisions", "token_id") and
                (TokenRevisionsTable.deleted eq false)
            projectId?.let {
                predicate = predicate and
                    ((TokenDesignSystemsTable.projectId eq it.value) or TokenDesignSystemsTable.projectId.isNull())
            }
            designSystemId?.let { predicate = predicate and (TokensTable.designSystemId eq it) }
            id?.let { predicate = predicate and (TokensTable.id eq it) }
            predicate
        }
        .toList()

    private fun currentTokenRow(id: UUID) = currentTokenRows(id = id).singleOrNull()

    private fun currentTenantIds(designSystemId: UUID): Set<UUID> = TokenTenantsTable
        .join(
            TokenTenantRevisionsTable,
            JoinType.INNER,
            TokenTenantsTable.id,
            TokenTenantRevisionsTable.tenantId,
        )
        .join(
            TokenVersionBoundariesTable,
            JoinType.INNER,
            TokenTenantRevisionsTable.designSystemId,
            TokenVersionBoundariesTable.designSystemId,
        )
        .selectAll()
        .where {
            selectedVersionBoundary("design_system_versions") and
                (TokenTenantRevisionsTable.versionSequenceNumber lessEq TokenVersionBoundariesTable.sequenceNumber) and
                latestRevision("tenant_revisions", "tenant_id") and
                (TokenTenantRevisionsTable.deleted eq false) and
                (TokenTenantsTable.designSystemId eq designSystemId)
        }
        .toList()
        .mapTo(hashSetOf()) { it[TokenTenantsTable.id] }

    private fun draft(designSystemId: UUID): ResultRow? {
        lockDesignSystemMutation(designSystemId)
        return TokenVersionBoundariesTable.selectAll().where {
            (TokenVersionBoundariesTable.designSystemId eq designSystemId) and
                (TokenVersionBoundariesTable.status eq TokenVersionBoundaryStatus.DRAFT)
        }.singleOrNull()
    }
}
