package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.components.domain.AppearanceVariation
import com.dsbuilder.ds.components.domain.AppearanceVariationAxis
import com.dsbuilder.ds.components.domain.AppearanceVariationValue
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Persistence port for appearances and their declared variation axes and values. */
@Suppress("TooManyFunctions")
interface AppearanceRepository {
    /** Performs the list operation. */
    suspend fun list(projectId: ProjectId, systemAdmin: Boolean): List<Appearance>

    /** Performs the find operation. */
    suspend fun find(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Appearance?

    /** Performs the create operation. */
    suspend fun create(projectId: ProjectId, systemAdmin: Boolean, command: AppearanceCreate): Appearance?

    /** Performs the update operation. */
    suspend fun update(projectId: ProjectId, systemAdmin: Boolean, id: UUID, command: AppearanceUpdate): Appearance?

    /** Performs the delete operation. */
    suspend fun delete(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Performs the axes operation. */
    suspend fun axes(projectId: ProjectId, systemAdmin: Boolean, appearanceId: UUID): List<AppearanceVariationAxis>?

    /** Performs the list variations operation. */
    suspend fun listVariations(projectId: ProjectId, systemAdmin: Boolean): List<AppearanceVariation>

    /** Performs the find variation operation. */
    suspend fun findVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): AppearanceVariation?

    /** Performs the create variation operation. */
    suspend fun createVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: VariationCreate,
    ): AppearanceVariation?

    /** Performs the update variation operation. */
    suspend fun updateVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: VariationUpdate,
    ): AppearanceVariation?

    /** Performs the delete variation operation. */
    suspend fun deleteVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Performs the list values operation. */
    suspend fun listValues(projectId: ProjectId, systemAdmin: Boolean): List<AppearanceVariationValue>

    /** Performs the find value operation. */
    suspend fun findValue(projectId: ProjectId, systemAdmin: Boolean, id: UUID): AppearanceVariationValue?

    /** Performs the create value operation. */
    suspend fun createValue(projectId: ProjectId, systemAdmin: Boolean, command: ValueCreate): AppearanceVariationValue?

    /** Performs the update value operation. */
    suspend fun updateValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ValueUpdate,
    ): AppearanceVariationValue?

    /** Performs the delete value operation. */
    suspend fun deleteValue(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Public model for appearance create. */
    data class AppearanceCreate(
        /** Design system id carried by this contract. */
        val designSystemId: UUID,
        /** Component id carried by this contract. */
        val componentId: UUID,
        /** Name carried by this contract. */
        val name: String?,
    )

    /** Public model for appearance update. */
    data class AppearanceUpdate(
        /** Name carried by this contract. */
        val name: String?,
    )

    /** Public model for variation create. */
    data class VariationCreate(
        /** Appearance id carried by this contract. */
        val appearanceId: UUID,
        /** Variation id carried by this contract. */
        val variationId: UUID,
        /** Position carried by this contract. */
        val position: Int,
        /** Default style id carried by this contract. */
        val defaultStyleId: UUID?,
        /** Is color scheme carried by this contract. */
        val isColorScheme: Boolean,
        /** Назначает ось корневой. */
        val isRoot: Boolean,
        /** Declared type carried by this contract. */
        val declaredType: String?,
    )

    /** Public model for variation update. */
    data class VariationUpdate(
        /** Position carried by this contract. */
        val position: Int?,
        /** Default style id carried by this contract. */
        val defaultStyleId: UUID?,
        /** Default style id present carried by this contract. */
        val defaultStyleIdPresent: Boolean,
        /** Is color scheme carried by this contract. */
        val isColorScheme: Boolean?,
        /** Назначает ось корневой (`true`) или снимает с неё роль (`false`). */
        val isRoot: Boolean?,
        /** Declared type carried by this contract. */
        val declaredType: String?,
        /** Declared type present carried by this contract. */
        val declaredTypePresent: Boolean,
    )

    /** Public model for value create. */
    data class ValueCreate(
        /** Appearance variation id carried by this contract. */
        val appearanceVariationId: UUID,
        /** Style id carried by this contract. */
        val styleId: UUID,
        /** Position carried by this contract. */
        val position: Int,
        /** Authored id carried by this contract. */
        val authoredId: String?,
    )

    /** Public model for value update. */
    data class ValueUpdate(
        /** Position carried by this contract. */
        val position: Int?,
        /** Authored id carried by this contract. */
        val authoredId: String?,
        /** Authored id present carried by this contract. */
        val authoredIdPresent: Boolean,
    )
}
