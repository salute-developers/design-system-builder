@file:Suppress("TrailingCommaOnCallSite")

package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.StyleCombinationRepository
import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.components.domain.StyleCombination
import com.dsbuilder.ds.components.domain.StyleCombinationMember
import com.dsbuilder.ds.components.domain.StyleCombinationMemberDetails
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Exposed persistence for style combinations and their members. */
@Suppress("TooManyFunctions")
class ExposedStyleCombinationRepository : StyleCombinationRepository {
    override suspend fun list(projectId: ProjectId, systemAdmin: Boolean): List<StyleCombination> =
        StyleCombinationsTable.selectAll().where {
            ComponentOwnership.readableProperty(StyleCombinationsTable.propertyId, projectId, systemAdmin) and
                ComponentOwnership.readableAppearance(StyleCombinationsTable.appearanceId, projectId, systemAdmin)
        }.map(::styleCombination)

    override suspend fun find(projectId: ProjectId, systemAdmin: Boolean, id: UUID): StyleCombination? =
        StyleCombinationsTable.selectAll().where {
            (StyleCombinationsTable.id eq id) and
                ComponentOwnership.readableProperty(StyleCombinationsTable.propertyId, projectId, systemAdmin) and
                ComponentOwnership.readableAppearance(StyleCombinationsTable.appearanceId, projectId, systemAdmin)
        }.singleOrNull()?.let(::styleCombination)

    override suspend fun create(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: StyleCombinationRepository.Create,
    ): StyleCombination? {
        if (!canWriteReferences(projectId, systemAdmin, command)) return null
        val designSystemId = ComponentAppearancesTable.selectAll()
            .where { ComponentAppearancesTable.id eq command.appearanceId }
            .single()[ComponentAppearancesTable.designSystemId]
        val id = StableStyleCombinationsTable.insertReturning {
            it[propertyId] = command.propertyId
            it[appearanceId] = command.appearanceId
            it[StableStyleCombinationsTable.designSystemId] = designSystemId
        }.single()[StableStyleCombinationsTable.id]
        StyleCombinationRevisionsTable.replaceRevision(
            StyleCombinationRevisionsTable.entityId,
            id,
            designSystemId,
        ) { statement ->
            statement[combinationKey] = command.combinationKey.orEmpty()
            statement[value] = command.value
            statement[tokenId] = command.tokenId
            statement[alpha] = command.alpha
            statement[adjustment] = command.adjustment
            statement[position] = 0
            statement[stateSetId] = command.stateSetId
        }
        return find(projectId, systemAdmin, id)
    }

    @Suppress("CyclomaticComplexMethod", "ReturnCount")
    override suspend fun update(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: StyleCombinationRepository.Update,
    ): StyleCombination? {
        if (command.tokenId != null && !ComponentOwnership.canReadToken(projectId, systemAdmin, command.tokenId)) {
            return null
        }
        if (
            command.stateSetId != null &&
            !ComponentOwnership.canReadStateSet(projectId, systemAdmin, command.stateSetId)
        ) {
            return null
        }
        if (!lockComponentSubject(
                StableStyleCombinationsTable,
                StableStyleCombinationsTable.id,
                StableStyleCombinationsTable.designSystemId,
                "style-combination",
                id,
            )
        ) {
            return null
        }
        val existing = StyleCombinationsTable.selectAll().where {
            (StyleCombinationsTable.id eq id) and
                ComponentOwnership.writableProperty(StyleCombinationsTable.propertyId, projectId, systemAdmin) and
                ComponentOwnership.writableAppearance(StyleCombinationsTable.appearanceId, projectId, systemAdmin)
        }.singleOrNull() ?: return null
        val designSystemId = existing[StyleCombinationsTable.designSystemId]
        val changedPaths = buildSet {
            if (command.value != null) add("/value")
            if (command.tokenIdPresent) add("/token_id")
            if (command.alphaPresent) add("/alpha")
            if (command.adjustmentPresent) add("/adjustment")
            if (command.stateSetId != null) add("/state_set_id")
        }
        if (changedPaths.isEmpty()) return styleCombination(existing)
        StyleCombinationRevisionsTable.replaceRevision(
            StyleCombinationRevisionsTable.entityId,
            id,
            designSystemId,
            changedPaths = changedPaths,
        ) { statement ->
            statement[combinationKey] = existing[StyleCombinationsTable.combinationKey]
            statement[value] = command.value ?: existing[StyleCombinationsTable.value]
            statement[tokenId] = if (command.tokenIdPresent) {
                command.tokenId
            } else {
                existing[StyleCombinationsTable.tokenId]
            }
            statement[alpha] = if (command.alphaPresent) command.alpha else existing[StyleCombinationsTable.alpha]
            statement[adjustment] = if (command.adjustmentPresent) {
                command.adjustment
            } else {
                existing[StyleCombinationsTable.adjustment]
            }
            statement[position] = existing[StyleCombinationsTable.position]
            statement[stateSetId] = command.stateSetId ?: existing[StyleCombinationsTable.stateSetId]
        }
        return find(projectId, systemAdmin, id)
    }

    override suspend fun delete(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!lockComponentSubject(
                StableStyleCombinationsTable,
                StableStyleCombinationsTable.id,
                StableStyleCombinationsTable.designSystemId,
                "style-combination",
                id,
            )
        ) {
            return false
        }
        val existing = StyleCombinationsTable.selectAll().where {
            (StyleCombinationsTable.id eq id) and
                ComponentOwnership.writableProperty(StyleCombinationsTable.propertyId, projectId, systemAdmin) and
                ComponentOwnership.writableAppearance(StyleCombinationsTable.appearanceId, projectId, systemAdmin)
        }.singleOrNull() ?: return false
        val designSystemId = existing[StyleCombinationsTable.designSystemId]
        StyleCombinationRevisionsTable.replaceRevision(
            StyleCombinationRevisionsTable.entityId,
            id,
            designSystemId,
            deleted = true,
        )
        return true
    }

    override suspend fun listMembers(projectId: ProjectId, systemAdmin: Boolean): List<StyleCombinationMember> =
        StyleCombinationMembersTable.selectAll().where {
            ComponentOwnership.readableStyleCombination(
                StyleCombinationMembersTable.combinationId,
                projectId,
                systemAdmin,
            ) and
                ComponentOwnership.readableStyle(StyleCombinationMembersTable.styleId, projectId, systemAdmin)
        }.map(::styleCombinationMember)

    override suspend fun listMembersByCombination(
        projectId: ProjectId,
        systemAdmin: Boolean,
        combinationId: UUID,
    ): List<StyleCombinationMemberDetails>? {
        return StyleCombinationMembersTable.selectAll()
            .where {
                (StyleCombinationMembersTable.combinationId eq combinationId) and
                    ComponentOwnership.readableStyleCombination(
                        StyleCombinationMembersTable.combinationId,
                        projectId,
                        systemAdmin,
                    ) and ComponentOwnership.readableStyle(
                        StyleCombinationMembersTable.styleId,
                        projectId,
                        systemAdmin,
                    )
            }
            .map(::styleCombinationMember)
            .mapNotNull { member -> styleDetails(member)?.let { StyleCombinationMemberDetails(member, it) } }
    }

    override suspend fun findMember(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): StyleCombinationMember? = StyleCombinationMembersTable.selectAll().where {
        (StyleCombinationMembersTable.id eq id) and
            ComponentOwnership.readableStyleCombination(
                StyleCombinationMembersTable.combinationId,
                projectId,
                systemAdmin,
            ) and
            ComponentOwnership.readableStyle(StyleCombinationMembersTable.styleId, projectId, systemAdmin)
    }.singleOrNull()?.let(::styleCombinationMember)

    @Suppress("ReturnCount")
    override suspend fun createMember(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: StyleCombinationRepository.MemberCreate,
    ): StyleCombinationMember? {
        val combination = find(projectId, systemAdmin, command.combinationId) ?: return null
        if (!canWrite(projectId, systemAdmin, combination)) return null
        if (!ComponentOwnership.canWriteStyle(projectId, systemAdmin, command.styleId)) return null
        val designSystemId = StyleCombinationsTable.selectAll()
            .where { StyleCombinationsTable.id eq command.combinationId }
            .single()[StyleCombinationsTable.designSystemId]
        val id = StableStyleCombinationMembersTable.insertReturning {
            it[combinationId] = command.combinationId
            it[StableStyleCombinationMembersTable.designSystemId] = designSystemId
        }.single()[StableStyleCombinationMembersTable.id]
        StyleCombinationMemberRevisionsTable.replaceRevision(
            StyleCombinationMemberRevisionsTable.entityId,
            id,
            designSystemId,
        ) { statement -> statement[styleId] = command.styleId }
        return findMember(projectId, systemAdmin, id)
    }

    @Suppress("ReturnCount")
    override suspend fun deleteMember(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!lockComponentSubject(
                StableStyleCombinationMembersTable,
                StableStyleCombinationMembersTable.id,
                StableStyleCombinationMembersTable.designSystemId,
                "style-combination-member",
                id,
            )
        ) {
            return false
        }
        val existing = StyleCombinationMembersTable.selectAll().where {
            (StyleCombinationMembersTable.id eq id) and
                ComponentOwnership.writableStyleCombination(
                    StyleCombinationMembersTable.combinationId,
                    projectId,
                    systemAdmin,
                ) and
                ComponentOwnership.writableStyle(StyleCombinationMembersTable.styleId, projectId, systemAdmin)
        }.singleOrNull() ?: return false
        val designSystemId = StableStyleCombinationMembersTable.selectAll()
            .where { StableStyleCombinationMembersTable.id eq id }
            .single()[StableStyleCombinationMembersTable.designSystemId]
        StyleCombinationMemberRevisionsTable.replaceRevision(
            StyleCombinationMemberRevisionsTable.entityId,
            id,
            designSystemId,
            deleted = true,
        )
        return true
    }
}

private fun styleCombination(row: ResultRow) = StyleCombination(
    row[StyleCombinationsTable.id], row[StyleCombinationsTable.propertyId],
    row[StyleCombinationsTable.appearanceId], row[StyleCombinationsTable.combinationKey],
    row[StyleCombinationsTable.value], row[StyleCombinationsTable.tokenId], row[StyleCombinationsTable.alpha],
    row[StyleCombinationsTable.adjustment], row[StyleCombinationsTable.position],
    row[StyleCombinationsTable.stateSetId], row[StyleCombinationsTable.createdAt],
    row[StyleCombinationsTable.updatedAt],
)

private fun styleCombinationMember(row: ResultRow) = StyleCombinationMember(
    row[StyleCombinationMembersTable.id],
    row[StyleCombinationMembersTable.combinationId],
    row[StyleCombinationMembersTable.styleId],
    row[StyleCombinationMembersTable.createdAt],
    row[StyleCombinationMembersTable.updatedAt],
)

private fun styleDetails(member: StyleCombinationMember): ComponentStyleSummary? = ComponentStylesTable.selectAll()
    .where { ComponentStylesTable.id eq member.styleId }
    .singleOrNull()
    ?.let { row ->
        ComponentStyleSummary(
            row[ComponentStylesTable.id],
            row[ComponentStylesTable.designSystemId],
            row[ComponentStylesTable.variationId],
            row[ComponentStylesTable.name],
            row[ComponentStylesTable.description],
            row[ComponentStylesTable.createdAt],
            row[ComponentStylesTable.updatedAt],
        )
    }

private fun canWriteReferences(
    projectId: ProjectId,
    systemAdmin: Boolean,
    command: StyleCombinationRepository.Create,
): Boolean = ComponentOwnership.canWriteProperty(projectId, systemAdmin, command.propertyId) &&
    ComponentOwnership.canWriteAppearance(projectId, systemAdmin, command.appearanceId) &&
    ComponentOwnership.canReadStateSet(projectId, systemAdmin, command.stateSetId) &&
    (command.tokenId == null || ComponentOwnership.canReadToken(projectId, systemAdmin, command.tokenId))

private fun canWrite(projectId: ProjectId, systemAdmin: Boolean, value: StyleCombination): Boolean =
    ComponentOwnership.canWriteProperty(projectId, systemAdmin, value.propertyId) &&
        ComponentOwnership.canWriteAppearance(projectId, systemAdmin, value.appearanceId)
