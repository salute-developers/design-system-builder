package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import com.dsbuilder.ds.components.domain.InvariantPlatformParamAdjustment
import com.dsbuilder.ds.components.domain.PropertyPlatformParam
import com.dsbuilder.ds.components.domain.PropertyVariation
import com.dsbuilder.ds.components.domain.VariationPlatformParamAdjustment
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Persistence port for the component variation and property model. */
@Suppress("TooManyFunctions")
interface ComponentModelRepository {
    /** Performs the list variations operation. */
    suspend fun listVariations(projectId: ProjectId, systemAdmin: Boolean): List<ComponentVariationSummary>

    /** Performs the find variation operation. */
    suspend fun findVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ComponentVariationSummary?

    /** Performs the create variation operation. */
    suspend fun createVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: VariationCreate,
    ): ComponentVariationSummary?

    /** Performs the update variation operation. */
    suspend fun updateVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: VariationUpdate,
    ): ComponentVariationSummary?

    /** Performs the delete variation operation. */
    suspend fun deleteVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Performs the variation styles operation. */
    suspend fun variationStyles(projectId: ProjectId, systemAdmin: Boolean, id: UUID): List<ComponentStyleSummary>?

    /** Performs the variation properties operation. */
    suspend fun variationProperties(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): List<ComponentPropertySummary>?

    /** Performs the list properties operation. */
    suspend fun listProperties(projectId: ProjectId, systemAdmin: Boolean): List<ComponentPropertySummary>

    /** Performs the find property operation. */
    suspend fun findProperty(projectId: ProjectId, systemAdmin: Boolean, id: UUID): ComponentPropertySummary?

    /** Performs the create property operation. */
    suspend fun createProperty(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: PropertyCreate,
    ): ComponentPropertySummary?

    /** Performs the update property operation. */
    suspend fun updateProperty(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: PropertyUpdate,
    ): ComponentPropertySummary?

    /** Performs the delete property operation. */
    suspend fun deleteProperty(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Performs the list platform params operation. */
    suspend fun listPlatformParams(projectId: ProjectId, systemAdmin: Boolean): List<PropertyPlatformParam>

    /** Performs the find platform param operation. */
    suspend fun findPlatformParam(projectId: ProjectId, systemAdmin: Boolean, id: UUID): PropertyPlatformParam?

    /** Performs the create platform param operation. */
    suspend fun createPlatformParam(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: PlatformParamCreate,
    ): PropertyPlatformParam?

    /** Performs the update platform param operation. */
    suspend fun updatePlatformParam(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: PlatformParamUpdate,
    ): PropertyPlatformParam?

    /** Performs the delete platform param operation. */
    suspend fun deletePlatformParam(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Performs the list property variations operation. */
    suspend fun listPropertyVariations(projectId: ProjectId, systemAdmin: Boolean): List<PropertyVariation>

    /** Performs the find property variation operation. */
    suspend fun findPropertyVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): PropertyVariation?

    /** Performs the create property variation operation. */
    suspend fun createPropertyVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: PropertyVariationCreate,
    ): PropertyVariation?

    /** Performs the delete property variation operation. */
    suspend fun deletePropertyVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Performs the list variation adjustments operation. */
    suspend fun listVariationAdjustments(
        projectId: ProjectId,
        systemAdmin: Boolean,
    ): List<VariationPlatformParamAdjustment>

    /** Performs the find variation adjustment operation. */
    suspend fun findVariationAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): VariationPlatformParamAdjustment?

    /** Performs the create variation adjustment operation. */
    suspend fun createVariationAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: VariationAdjustmentCreate,
    ): VariationPlatformParamAdjustment?

    /** Performs the update variation adjustment operation. */
    suspend fun updateVariationAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: AdjustmentUpdate,
    ): VariationPlatformParamAdjustment?

    /** Performs the delete variation adjustment operation. */
    suspend fun deleteVariationAdjustment(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Performs the list invariant adjustments operation. */
    suspend fun listInvariantAdjustments(
        projectId: ProjectId,
        systemAdmin: Boolean,
    ): List<InvariantPlatformParamAdjustment>

    /** Performs the find invariant adjustment operation. */
    suspend fun findInvariantAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): InvariantPlatformParamAdjustment?

    /** Performs the create invariant adjustment operation. */
    suspend fun createInvariantAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: InvariantAdjustmentCreate,
    ): InvariantPlatformParamAdjustment?

    /** Performs the update invariant adjustment operation. */
    suspend fun updateInvariantAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: AdjustmentUpdate,
    ): InvariantPlatformParamAdjustment?

    /** Performs the delete invariant adjustment operation. */
    suspend fun deleteInvariantAdjustment(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean

    /** Public model for variation create. */
    data class VariationCreate(
        /** Component id carried by this contract. */
        val componentId: UUID,
        /** Name carried by this contract. */
        val name: String,
        /** Description carried by this contract. */
        val description: String?,
    )

    /** Public model for variation update. */
    data class VariationUpdate(
        /** Name carried by this contract. */
        val name: String?,
        /** Description carried by this contract. */
        val description: String?,
        /** Description present carried by this contract. */
        val descriptionPresent: Boolean,
    )

    /** Public model for property create. */
    data class PropertyCreate(
        /** Component id carried by this contract. */
        val componentId: UUID?,
        /** Name carried by this contract. */
        val name: String,
        /** Type carried by this contract. */
        val type: String,
        /** Default value carried by this contract. */
        val defaultValue: String?,
        /** Description carried by this contract. */
        val description: String?,
        /** Platform carried by this contract. */
        val platform: String?,
    )

    /** Public model for property update. */
    data class PropertyUpdate(
        /** Name carried by this contract. */
        val name: String?,
        /** Type carried by this contract. */
        val type: String?,
        /** Default value carried by this contract. */
        val defaultValue: String?,
        /** Default value present carried by this contract. */
        val defaultValuePresent: Boolean,
        /** Description carried by this contract. */
        val description: String?,
        /** Description present carried by this contract. */
        val descriptionPresent: Boolean,
        /** Platform carried by this contract. */
        val platform: String?,
        /** Platform present carried by this contract. */
        val platformPresent: Boolean,
    )

    /** Public model for platform param create. */
    data class PlatformParamCreate(
        /** Property id carried by this contract. */
        val propertyId: UUID,
        /** Platform carried by this contract. */
        val platform: String,
        /** Name carried by this contract. */
        val name: String,
    )

    /** Public model for platform param update. */
    data class PlatformParamUpdate(
        /** Platform carried by this contract. */
        val platform: String?,
        /** Name carried by this contract. */
        val name: String?,
    )

    /** Public model for property variation create. */
    data class PropertyVariationCreate(
        /** Property id carried by this contract. */
        val propertyId: UUID,
        /** Variation id carried by this contract. */
        val variationId: UUID,
    )

    /** Public model for variation adjustment create. */
    data class VariationAdjustmentCreate(
        /** Vpv id carried by this contract. */
        val vpvId: UUID,
        /** Platform param id carried by this contract. */
        val platformParamId: UUID,
        /** Value carried by this contract. */
        val value: String?,
        /** Template carried by this contract. */
        val template: String?,
    )

    /** Public model for invariant adjustment create. */
    data class InvariantAdjustmentCreate(
        /** Ipv id carried by this contract. */
        val ipvId: UUID,
        /** Platform param id carried by this contract. */
        val platformParamId: UUID,
        /** Value carried by this contract. */
        val value: String?,
        /** Template carried by this contract. */
        val template: String?,
    )

    /** Public model for adjustment update. */
    data class AdjustmentUpdate(
        /** Value carried by this contract. */
        val value: String?,
        /** Value present carried by this contract. */
        val valuePresent: Boolean,
        /** Template carried by this contract. */
        val template: String?,
        /** Template present carried by this contract. */
        val templatePresent: Boolean,
    )
}
