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
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
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
        return StyleCombinationsTable.insertReturning {
            it[propertyId] = command.propertyId
            it[appearanceId] = command.appearanceId
            command.combinationKey?.let { key -> it[combinationKey] = key }
            it[value] = command.value
            it[tokenId] = command.tokenId
            it[alpha] = command.alpha
            it[adjustment] = command.adjustment
            it[stateSetId] = command.stateSetId
        }.single().let(::styleCombination)
    }

    @Suppress("ReturnCount")
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
        return StyleCombinationsTable.updateReturning(where = {
            (StyleCombinationsTable.id eq id) and
                ComponentOwnership.writableProperty(StyleCombinationsTable.propertyId, projectId, systemAdmin) and
                ComponentOwnership.writableAppearance(StyleCombinationsTable.appearanceId, projectId, systemAdmin)
        }) {
            command.value?.let { newValue -> it[value] = newValue }
            if (command.tokenIdPresent) it[tokenId] = command.tokenId
            if (command.alphaPresent) it[alpha] = command.alpha
            if (command.adjustmentPresent) it[adjustment] = command.adjustment
            command.stateSetId?.let { newStateSet -> it[stateSetId] = newStateSet }
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::styleCombination)
    }

    override suspend fun delete(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        return StyleCombinationsTable.deleteWhere {
            (StyleCombinationsTable.id eq id) and
                ComponentOwnership.writableProperty(StyleCombinationsTable.propertyId, projectId, systemAdmin) and
                ComponentOwnership.writableAppearance(StyleCombinationsTable.appearanceId, projectId, systemAdmin)
        } > 0
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
        return StyleCombinationMembersTable.insertReturning {
            it[combinationId] = command.combinationId
            it[styleId] = command.styleId
        }.single().let(::styleCombinationMember)
    }

    @Suppress("ReturnCount")
    override suspend fun deleteMember(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        return StyleCombinationMembersTable.deleteWhere {
            (StyleCombinationMembersTable.id eq id) and
                ComponentOwnership.writableStyleCombination(
                    StyleCombinationMembersTable.combinationId,
                    projectId,
                    systemAdmin,
                ) and
                ComponentOwnership.writableStyle(StyleCombinationMembersTable.styleId, projectId, systemAdmin)
        } > 0
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
