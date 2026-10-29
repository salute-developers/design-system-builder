package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.StyleCombination
import com.dsbuilder.ds.components.domain.StyleCombinationMember
import com.dsbuilder.ds.components.domain.StyleCombinationMemberDetails
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Persistence port for style combinations and their members. */
@Suppress("TooManyFunctions")
interface StyleCombinationRepository {
    /** Performs the list operation. */
    suspend fun list(projectId: ProjectId, systemAdmin: Boolean): List<StyleCombination>

    /** Performs the find operation. */
    suspend fun find(projectId: ProjectId, systemAdmin: Boolean, id: UUID): StyleCombination?

    /** Performs the create operation. */
    suspend fun create(projectId: ProjectId, systemAdmin: Boolean, command: Create): StyleCombination?

    /** Performs the update operation. */
    suspend fun update(projectId: ProjectId, systemAdmin: Boolean, id: UUID, command: Update): StyleCombination?

    /** Performs the delete operation. */
    suspend fun delete(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Performs the list members operation. */
    suspend fun listMembers(projectId: ProjectId, systemAdmin: Boolean): List<StyleCombinationMember>

    /** Performs the list members by combination operation. */
    suspend fun listMembersByCombination(
        projectId: ProjectId,
        systemAdmin: Boolean,
        combinationId: UUID,
    ): List<StyleCombinationMemberDetails>?

    /** Performs the find member operation. */
    suspend fun findMember(projectId: ProjectId, systemAdmin: Boolean, id: UUID): StyleCombinationMember?

    /** Performs the create member operation. */
    suspend fun createMember(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: MemberCreate,
    ): StyleCombinationMember?

    /** Performs the delete member operation. */
    suspend fun deleteMember(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Public model for create. */
    data class Create(
        /** Property id carried by this contract. */
        val propertyId: UUID,
        /** Appearance id carried by this contract. */
        val appearanceId: UUID,
        /** Combination key carried by this contract. */
        val combinationKey: String?,
        /** Value carried by this contract. */
        val value: String,
        /** Token id carried by this contract. */
        val tokenId: UUID?,
        /** Alpha carried by this contract. */
        val alpha: String?,
        /** Adjustment carried by this contract. */
        val adjustment: String?,
        /** State set id carried by this contract. */
        val stateSetId: UUID,
    )

    /** Public model for update. */
    data class Update(
        /** Value carried by this contract. */
        val value: String?,
        /** Token id carried by this contract. */
        val tokenId: UUID?,
        /** Token id present carried by this contract. */
        val tokenIdPresent: Boolean,
        /** Alpha carried by this contract. */
        val alpha: String?,
        /** Alpha present carried by this contract. */
        val alphaPresent: Boolean,
        /** Adjustment carried by this contract. */
        val adjustment: String?,
        /** Adjustment present carried by this contract. */
        val adjustmentPresent: Boolean,
        /** State set id carried by this contract. */
        val stateSetId: UUID?,
    )

    /** Public model for member create. */
    data class MemberCreate(
        /** Combination id carried by this contract. */
        val combinationId: UUID,
        /** Style id carried by this contract. */
        val styleId: UUID,
    )
}
