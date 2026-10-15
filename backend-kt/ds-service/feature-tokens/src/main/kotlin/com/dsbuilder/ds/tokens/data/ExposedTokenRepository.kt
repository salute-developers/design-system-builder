package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.latestRevision
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.core.data.selectedVersionBoundary
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.tokens.application.CreateToken
import com.dsbuilder.ds.tokens.application.TokenRepository
import com.dsbuilder.ds.tokens.application.TokenValueFilter
import com.dsbuilder.ds.tokens.application.UpdateToken
import com.dsbuilder.ds.tokens.domain.Token
import com.dsbuilder.ds.tokens.domain.TokenValue
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Exposed token repository with ownership resolved through design systems. */
class ExposedTokenRepository : TokenRepository {
    override suspend fun listAccessible(projectId: ProjectId): List<Token> = currentRows(projectId = projectId)
        .map(TokenRowMapper::map)

    override suspend fun findAccessible(projectId: ProjectId, id: UUID): Token? = currentRows(
        projectId = projectId,
        id = id,
    )
        .singleOrNull()
        ?.let(TokenRowMapper::map)

    override suspend fun nameExists(
        projectId: ProjectId,
        designSystemId: UUID,
        normalizedName: String,
        excludingId: UUID?,
    ): Boolean = currentRows(projectId = projectId, designSystemId = designSystemId).any { row ->
        row[TokensTable.designSystemId] == designSystemId &&
            row[TokenDesignSystemsTable.projectId] == projectId.value &&
            row[TokensTable.id] != excludingId &&
            row[TokenRevisionsTable.name].trim().lowercase() == normalizedName
    }

    override suspend fun createOwned(projectId: ProjectId, command: CreateToken): Token? {
        if (command.designSystemId != null && !ownedDesignSystem(projectId, command.designSystemId)) return null
        if (command.designSystemId == null) return null
        val entity = TokensTable.insertReturning {
            it[designSystemId] = command.designSystemId
        }.single()
        val draft = draft(command.designSystemId) ?: error("Active draft is missing")
        SubjectMutationPaths.with(setOf("/name", "/type", "/display_name", "/description", "/enabled")) {
            TokenRevisionsTable.insert {
                it[tokenId] = entity[TokensTable.id]
                it[designSystemId] = command.designSystemId
                it[designSystemVersionId] = draft[TokenVersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[TokenVersionBoundariesTable.sequenceNumber]
                it[name] = command.name
                it[type] = command.type
                it[displayName] = command.displayName
                it[description] = command.description
                it[enabled] = command.enabled ?: true
                it[deleted] = false
            }
        }
        return currentRow(entity[TokensTable.id])?.let(TokenRowMapper::map)
    }

    @Suppress("CyclomaticComplexMethod", "ReturnCount")
    override suspend fun updateOwned(projectId: ProjectId, id: UUID, command: UpdateToken): Token? {
        val current = currentRows(projectId = projectId, id = id).singleOrNull()
            ?.takeIf { it[TokenDesignSystemsTable.projectId] == projectId.value }
            ?: return null
        val designSystemId = requireNotNull(current[TokensTable.designSystemId])
        val draft = draft(designSystemId) ?: return null
        if (!lockDraftSubject(designSystemId, "token", id)) return null
        val changedPaths = buildSet {
            if (command.namePresent) add("/name")
            if (command.typePresent) add("/type")
            if (command.displayNamePresent) add("/display_name")
            if (command.descriptionPresent) add("/description")
            if (command.enabledPresent) add("/enabled")
        }
        if (changedPaths.isEmpty()) return current.let(TokenRowMapper::map)
        TokenRevisionsTable.deleteWhere {
            (TokenRevisionsTable.tokenId eq id) and
                (TokenRevisionsTable.designSystemVersionId eq draft[TokenVersionBoundariesTable.id])
        }
        SubjectMutationPaths.with(changedPaths) {
            TokenRevisionsTable.insert {
                it[tokenId] = id
                it[TokenRevisionsTable.designSystemId] = designSystemId
                it[designSystemVersionId] = draft[TokenVersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[TokenVersionBoundariesTable.sequenceNumber]
                it[name] = if (command.namePresent) requireNotNull(command.name) else current[TokenRevisionsTable.name]
                it[type] = if (command.typePresent) command.type else current[TokenRevisionsTable.type]
                it[displayName] = if (command.displayNamePresent) {
                    command.displayName
                } else {
                    current[TokenRevisionsTable.displayName]
                }
                it[description] = if (command.descriptionPresent) {
                    command.description
                } else {
                    current[TokenRevisionsTable.description]
                }
                it[enabled] = if (command.enabledPresent) {
                    command.enabled ?: true
                } else {
                    current[TokenRevisionsTable.enabled]
                }
                it[deleted] = false
            }
        }
        return currentRow(id)?.let(TokenRowMapper::map)
    }

    @Suppress("ReturnCount")
    override suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean {
        val current = currentRows(projectId = projectId, id = id).singleOrNull()
            ?.takeIf { it[TokenDesignSystemsTable.projectId] == projectId.value }
            ?: return false
        val designSystemId = requireNotNull(current[TokensTable.designSystemId])
        val draft = draft(designSystemId) ?: return false
        if (!lockDraftSubject(designSystemId, "token", id)) return false
        if (removeDraftOnlyToken(id, draft)) return true
        TokenRevisionsTable.deleteWhere {
            (TokenRevisionsTable.tokenId eq id) and
                (TokenRevisionsTable.designSystemVersionId eq draft[TokenVersionBoundariesTable.id])
        }
        SubjectMutationPaths.with(setOf("/deleted")) {
            TokenRevisionsTable.insert {
                it[tokenId] = id
                it[TokenRevisionsTable.designSystemId] = designSystemId
                it[designSystemVersionId] = draft[TokenVersionBoundariesTable.id]
                it[versionSequenceNumber] = draft[TokenVersionBoundariesTable.sequenceNumber]
                it[name] = current[TokenRevisionsTable.name]
                it[type] = current[TokenRevisionsTable.type]
                it[displayName] = current[TokenRevisionsTable.displayName]
                it[description] = current[TokenRevisionsTable.description]
                it[enabled] = current[TokenRevisionsTable.enabled]
                it[deleted] = true
            }
        }
        return true
    }

    /** Removes an unpublished token and all of its unpublished values as one aggregate. */
    private fun removeDraftOnlyToken(id: UUID, draft: ResultRow): Boolean {
        val draftId = draft[TokenVersionBoundariesTable.id]
        val tokenVersions = TokenRevisionsTable.selectAll()
            .where { TokenRevisionsTable.tokenId eq id }
            .map { it[TokenRevisionsTable.designSystemVersionId] }
        if (tokenVersions != listOf(draftId)) return false

        val valueIds = TokenValuesTable.selectAll()
            .where { TokenValuesTable.tokenId eq id }
            .map { it[TokenValuesTable.id] }
        val hasHistoricalValue = valueIds.isNotEmpty() && TokenValueRevisionsTable.selectAll().where {
            (TokenValueRevisionsTable.tokenValueId inList valueIds) and
                (TokenValueRevisionsTable.designSystemVersionId neq draftId)
        }.limit(1).any()
        if (hasHistoricalValue) return false

        if (valueIds.isNotEmpty()) {
            TokenValueRevisionsTable.deleteWhere { TokenValueRevisionsTable.tokenValueId inList valueIds }
            TokenValuesTable.deleteWhere { TokenValuesTable.id inList valueIds }
        }
        TokenRevisionsTable.deleteWhere { TokenRevisionsTable.tokenId eq id }
        TokensTable.deleteWhere { TokensTable.id eq id }
        return true
    }

    override suspend fun values(
        projectId: ProjectId,
        id: UUID,
        filter: TokenValueFilter,
    ): List<TokenValue>? {
        if (findAccessible(projectId, id) == null) return null
        val designSystemId = requireNotNull(
            TokensTable.selectAll().where { TokensTable.id eq id }.single()[TokensTable.designSystemId],
        )
        return currentTokenValueRows(
            designSystemId = designSystemId,
            tokenId = id,
            filter = filter,
        ).map(TokenValueRowMapper::map)
    }

    private fun currentRows(
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

    private fun currentRow(id: UUID) = currentRows(id = id).singleOrNull()

    private fun currentTokenValueRows(
        designSystemId: UUID,
        tokenId: UUID,
        filter: TokenValueFilter,
    ): List<ResultRow> = TokenValuesTable
        .join(TokenValueRevisionsTable, JoinType.INNER, TokenValuesTable.id, TokenValueRevisionsTable.tokenValueId)
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
                latestRevision("token_value_revisions", "token_value_id") and
                (TokenValueRevisionsTable.deleted eq false) and
                (TokenValuesTable.designSystemId eq designSystemId) and
                (TokenValuesTable.tokenId eq tokenId)
            filter.tenantId?.let { predicate = predicate and (TokenValuesTable.tenantId eq it) }
            filter.platform?.let { predicate = predicate and (TokenValuesTable.platform eq it) }
            filter.mode?.let { predicate = predicate and (TokenValuesTable.mode eq it) }
            predicate
        }
        .toList()
        .let { rows ->
            val tokenIds = currentRows(designSystemId = designSystemId, id = tokenId)
                .mapTo(hashSetOf()) { it[TokensTable.id] }
            val tenantIds = currentTenantIds(designSystemId)
            rows.filter { row ->
                row[TokenValuesTable.tokenId] in tokenIds && row[TokenValuesTable.tenantId] in tenantIds
            }
        }

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

    private fun ownedDesignSystem(projectId: ProjectId, id: UUID): Boolean = TokenDesignSystemsTable
        .selectAll()
        .where { (TokenDesignSystemsTable.id eq id) and (TokenDesignSystemsTable.projectId eq projectId.value) }
        .limit(1)
        .any()
}
