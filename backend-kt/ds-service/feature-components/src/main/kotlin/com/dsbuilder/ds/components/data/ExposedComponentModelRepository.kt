@file:Suppress("TrailingCommaOnCallSite")

package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ComponentModelRepository
import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.components.domain.ComponentStyleSummary
import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import com.dsbuilder.ds.components.domain.InvariantPlatformParamAdjustment
import com.dsbuilder.ds.components.domain.PropertyPlatformParam
import com.dsbuilder.ds.components.domain.PropertyVariation
import com.dsbuilder.ds.components.domain.VariationPlatformParamAdjustment
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.updateReturning
import java.time.Instant
import java.util.UUID

/** Exposed persistence for variations, properties, platform params, links, and adjustments. */
@Suppress("TooManyFunctions")
class ExposedComponentModelRepository : ComponentModelRepository {
    override suspend fun listVariations(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID?,
    ): List<ComponentVariationSummary> = VariationsTable.selectAll().where {
        ComponentOwnership.readableVariation(VariationsTable.id, projectId, systemAdmin) and
            (designSystemId?.let { VariationsTable.designSystemId eq it } ?: Op.TRUE)
    }.map(::variationModel)

    override suspend fun variationNameExists(
        designSystemId: UUID,
        componentId: UUID,
        normalizedName: String,
        excludingId: UUID?,
    ): Boolean = VariationsTable.selectAll().where {
        (VariationsTable.designSystemId eq designSystemId) and (VariationsTable.componentId eq componentId)
    }.any { row ->
        row[VariationsTable.id] != excludingId && row[VariationsTable.name].trim().lowercase() == normalizedName
    }

    override suspend fun findVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): ComponentVariationSummary? = VariationsTable.selectAll().where {
        (VariationsTable.id eq id) and ComponentOwnership.readableVariation(VariationsTable.id, projectId, systemAdmin)
    }.singleOrNull()?.let(::variationModel)

    override suspend fun canWriteVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean =
        ComponentOwnership.canWriteVariation(projectId, systemAdmin, id)

    override suspend fun canCreateVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
        componentId: UUID,
    ): Boolean = ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, designSystemId) &&
        DesignSystemComponentsTable.selectAll().where {
            (DesignSystemComponentsTable.designSystemId eq designSystemId) and
                (DesignSystemComponentsTable.componentId eq componentId)
        }.any()

    override suspend fun createVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: ComponentModelRepository.VariationCreate,
    ): ComponentVariationSummary? {
        if (!canCreateVariation(projectId, systemAdmin, command.designSystemId, command.componentId)) return null
        val id = VariationWrites.create(command.designSystemId, command.componentId, command.name, command.description)
        return VariationsTable.selectAll().where { VariationsTable.id eq id }.single().let(::variationModel)
    }

    @Suppress("ReturnCount")
    override suspend fun updateVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ComponentModelRepository.VariationUpdate,
    ): ComponentVariationSummary? {
        if (!lockComponentSubject(
                StableVariationsTable,
                StableVariationsTable.id,
                StableVariationsTable.designSystemId,
                "variation",
                id,
            )
        ) {
            return null
        }
        val current = VariationsTable.selectAll().where {
            (VariationsTable.id eq id) and
                ComponentOwnership.writableVariation(VariationsTable.id, projectId, systemAdmin)
        }.singleOrNull() ?: return null
        val changedPaths = buildSet {
            if (command.name != null) add("/name")
            if (command.descriptionPresent) add("/description")
        }
        if (changedPaths.isEmpty()) return variationModel(current)
        command.name?.let { checkRenameAgainstAppearances(id, it) }
        VariationRevisionsTable.replaceRevision(
            VariationRevisionsTable.entityId,
            id,
            current[VariationsTable.designSystemId],
            changedPaths = changedPaths,
        ) {
            it[name] = command.name ?: current[VariationsTable.name]
            it[description] =
                if (command.descriptionPresent) command.description else current[VariationsTable.description]
        }
        return VariationsTable.selectAll().where { VariationsTable.id eq id }.single().let(::variationModel)
    }

    override suspend fun deleteVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!lockComponentSubject(
                StableVariationsTable,
                StableVariationsTable.id,
                StableVariationsTable.designSystemId,
                "variation",
                id,
            )
        ) {
            return false
        }
        val current = VariationsTable.selectAll().where {
            (VariationsTable.id eq id) and
                ComponentOwnership.writableVariation(VariationsTable.id, projectId, systemAdmin)
        }.singleOrNull() ?: return false
        if (variationInUse(id)) {
            throw EditorRuleViolationException(
                "variation_in_use",
                "The variation is used by styles, appearance axes or reuse configurations",
                conflict = true,
            )
        }
        VariationRevisionsTable.replaceRevision(
            VariationRevisionsTable.entityId,
            id,
            current[VariationsTable.designSystemId],
            deleted = true,
        ) {
            it[name] = current[VariationsTable.name]
            it[description] = current[VariationsTable.description]
        }
        return true
    }

    /** Новое имя оси не должно совпасть с действующим именем другой оси оформления, где ось не переименована. */
    private fun checkRenameAgainstAppearances(id: UUID, newName: String) {
        val target = newName.trim().lowercase()
        AppearanceVariationsTable.selectAll().where { AppearanceVariationsTable.variationId eq id }.forEach { axis ->
            if (axis[AppearanceVariationsTable.displayName] != null) return@forEach
            val taken = AppearanceEditorRules.axisNames(
                axis[AppearanceVariationsTable.appearanceId],
                excluding = axis[AppearanceVariationsTable.id],
            ).any { it == target }
            if (taken) {
                throw EditorRuleViolationException(
                    "axis_name_taken",
                    "The axis name is already used in an appearance of the design system",
                    conflict = true,
                )
            }
        }
    }

    private fun variationInUse(id: UUID): Boolean =
        ComponentStylesTable.selectAll().where { ComponentStylesTable.variationId eq id }.any() ||
            AppearanceVariationsTable.selectAll().where { AppearanceVariationsTable.variationId eq id }.any() ||
            ComponentReuseConfigsTable.selectAll().where { ComponentReuseConfigsTable.variationId eq id }.any()

    override suspend fun variationStyles(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): List<ComponentStyleSummary>? {
        return ComponentStylesTable.selectAll().where {
            (ComponentStylesTable.variationId eq id) and
                ComponentOwnership.readableVariation(ComponentStylesTable.variationId, projectId, systemAdmin) and
                ComponentOwnership.readableDesignSystem(ComponentStylesTable.designSystemId, projectId, systemAdmin)
        }.map(::componentStyle)
    }

    override suspend fun variationProperties(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): List<ComponentPropertySummary>? {
        return PropertiesTable.innerJoin(PropertyVariationsTable).select(PropertiesTable.columns).where {
            (PropertyVariationsTable.variationId eq id) and
                ComponentOwnership.readableVariation(PropertyVariationsTable.variationId, projectId, systemAdmin) and
                ComponentOwnership.readableProperty(PropertiesTable.id, projectId, systemAdmin)
        }.map(::propertyModel)
    }

    override suspend fun listProperties(projectId: ProjectId, systemAdmin: Boolean): List<ComponentPropertySummary> =
        PropertiesTable.selectAll().where {
            ComponentOwnership.readableProperty(PropertiesTable.id, projectId, systemAdmin)
        }.map(::propertyModel)

    override suspend fun findProperty(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): ComponentPropertySummary? = PropertiesTable.selectAll().where {
        (PropertiesTable.id eq id) and ComponentOwnership.readableProperty(PropertiesTable.id, projectId, systemAdmin)
    }.singleOrNull()?.let(::propertyModel)

    override suspend fun createProperty(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: ComponentModelRepository.PropertyCreate,
    ): ComponentPropertySummary? {
        if (command.componentId == null && !systemAdmin) return null
        if (
            command.componentId != null &&
            command.componentId !in ComponentOwnership.writableComponentIds(projectId, systemAdmin)
        ) {
            return null
        }
        return PropertiesTable.insertReturning {
            it[componentId] = command.componentId
            it[name] = command.name
            it[type] = requireNotNull(PropertyTypeDb.fromWire(command.type))
            it[defaultValue] = command.defaultValue
            it[description] = command.description
        }.single().let(::propertyModel)
    }

    override suspend fun updateProperty(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ComponentModelRepository.PropertyUpdate,
    ): ComponentPropertySummary? {
        return PropertiesTable.updateReturning(where = {
            (PropertiesTable.id eq id) and
                ComponentOwnership.writableProperty(PropertiesTable.id, projectId, systemAdmin)
        }) {
            command.name?.let { value -> it[name] = value }
            command.type?.let { value -> it[type] = requireNotNull(PropertyTypeDb.fromWire(value)) }
            if (command.defaultValuePresent) it[defaultValue] = command.defaultValue
            if (command.descriptionPresent) it[description] = command.description
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::propertyModel)
    }

    override suspend fun deleteProperty(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean =
        PropertiesTable.deleteWhere {
            (PropertiesTable.id eq id) and
                ComponentOwnership.writableProperty(PropertiesTable.id, projectId, systemAdmin)
        } > 0

    override suspend fun listPlatformParams(projectId: ProjectId, systemAdmin: Boolean): List<PropertyPlatformParam> =
        PropertyPlatformParamsTable.selectAll().where {
            ComponentOwnership.readableProperty(PropertyPlatformParamsTable.propertyId, projectId, systemAdmin)
        }.map(::platformParam)

    override suspend fun listPlatformParamsByProperties(
        projectId: ProjectId,
        systemAdmin: Boolean,
        propertyIds: Collection<UUID>,
    ): List<PropertyPlatformParam> {
        if (propertyIds.isEmpty()) return emptyList()
        return PropertyPlatformParamsTable.selectAll().where {
            (PropertyPlatformParamsTable.propertyId inList propertyIds) and
                ComponentOwnership.readableProperty(PropertyPlatformParamsTable.propertyId, projectId, systemAdmin)
        }.map(::platformParam)
    }

    override suspend fun findPlatformParam(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): PropertyPlatformParam? {
        return PropertyPlatformParamsTable.selectAll().where {
            (PropertyPlatformParamsTable.id eq id) and
                ComponentOwnership.readableProperty(PropertyPlatformParamsTable.propertyId, projectId, systemAdmin)
        }.singleOrNull()?.let(::platformParam)
    }

    override suspend fun createPlatformParam(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: ComponentModelRepository.PlatformParamCreate,
    ): PropertyPlatformParam? {
        if (!ComponentOwnership.canWriteProperty(projectId, systemAdmin, command.propertyId)) return null
        return PropertyPlatformParamsTable.insertReturning {
            it[propertyId] = command.propertyId
            it[platform] = requireNotNull(ComponentPlatformDb.fromWire(command.platform))
            it[name] = command.name
            command.deprecated?.let { value -> it[deprecated] = value }
            it[deprecatedMessage] = command.deprecatedMessage
        }.single().let(::platformParam)
    }

    override suspend fun updatePlatformParam(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ComponentModelRepository.PlatformParamUpdate,
    ): PropertyPlatformParam? {
        return PropertyPlatformParamsTable.updateReturning(where = {
            (PropertyPlatformParamsTable.id eq id) and
                ComponentOwnership.writableProperty(PropertyPlatformParamsTable.propertyId, projectId, systemAdmin)
        }) {
            command.platform?.let { value -> it[platform] = requireNotNull(ComponentPlatformDb.fromWire(value)) }
            command.name?.let { value -> it[name] = value }
            command.deprecated?.let { value -> it[deprecated] = value }
            if (command.deprecatedMessagePresent) it[deprecatedMessage] = command.deprecatedMessage
            it[updatedAt] = Instant.now()
        }.singleOrNull()?.let(::platformParam)
    }

    override suspend fun deletePlatformParam(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        return PropertyPlatformParamsTable.deleteWhere {
            (PropertyPlatformParamsTable.id eq id) and
                ComponentOwnership.writableProperty(PropertyPlatformParamsTable.propertyId, projectId, systemAdmin)
        } > 0
    }

    override suspend fun listPropertyVariations(projectId: ProjectId, systemAdmin: Boolean): List<PropertyVariation> =
        PropertyVariationsTable.selectAll().where {
            ComponentOwnership.readableProperty(PropertyVariationsTable.propertyId, projectId, systemAdmin) and
                ComponentOwnership.readableVariation(PropertyVariationsTable.variationId, projectId, systemAdmin)
        }.map(::propertyVariation)

    override suspend fun listPropertyVariationsByProperties(
        projectId: ProjectId,
        systemAdmin: Boolean,
        propertyIds: Collection<UUID>,
    ): List<PropertyVariation> {
        if (propertyIds.isEmpty()) return emptyList()
        return PropertyVariationsTable.selectAll().where {
            (PropertyVariationsTable.propertyId inList propertyIds) and
                ComponentOwnership.readableProperty(PropertyVariationsTable.propertyId, projectId, systemAdmin) and
                ComponentOwnership.readableVariation(PropertyVariationsTable.variationId, projectId, systemAdmin)
        }.map(::propertyVariation)
    }

    override suspend fun findPropertyVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): PropertyVariation? {
        return PropertyVariationsTable.selectAll().where {
            (PropertyVariationsTable.id eq id) and
                ComponentOwnership.readableProperty(PropertyVariationsTable.propertyId, projectId, systemAdmin) and
                ComponentOwnership.readableVariation(PropertyVariationsTable.variationId, projectId, systemAdmin)
        }.singleOrNull()?.let(::propertyVariation)
    }

    override suspend fun createPropertyVariation(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: ComponentModelRepository.PropertyVariationCreate,
    ): PropertyVariation? {
        if (!ComponentOwnership.canWriteProperty(projectId, systemAdmin, command.propertyId)) return null
        if (!ComponentOwnership.canWriteVariation(projectId, systemAdmin, command.variationId)) return null
        val owner = StableVariationsTable.selectAll().where { StableVariationsTable.id eq command.variationId }
            .single()[StableVariationsTable.designSystemId]
        return PropertyVariationsTable.insertReturning {
            it[propertyId] = command.propertyId
            it[variationId] = command.variationId
            it[designSystemId] = owner
        }.single().let(::propertyVariation)
    }

    @Suppress("ReturnCount")
    override suspend fun deletePropertyVariation(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        return PropertyVariationsTable.deleteWhere {
            (PropertyVariationsTable.id eq id) and
                ComponentOwnership.writableProperty(PropertyVariationsTable.propertyId, projectId, systemAdmin) and
                ComponentOwnership.writableVariation(PropertyVariationsTable.variationId, projectId, systemAdmin)
        } > 0
    }

    override suspend fun listVariationAdjustments(
        projectId: ProjectId,
        systemAdmin: Boolean,
    ): List<VariationPlatformParamAdjustment> = VariationPlatformParamAdjustmentsTable.selectAll()
        .where {
            ComponentOwnership.readableVariationPropertyValue(
                VariationPlatformParamAdjustmentsTable.vpvId,
                projectId,
                systemAdmin,
            ) and ComponentOwnership.readablePlatformParam(
                VariationPlatformParamAdjustmentsTable.platformParamId,
                projectId,
                systemAdmin,
            )
        }.map(::variationAdjustment)

    override suspend fun findVariationAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): VariationPlatformParamAdjustment? = VariationPlatformParamAdjustmentsTable.selectAll()
        .where {
            (VariationPlatformParamAdjustmentsTable.id eq id) and
                ComponentOwnership.readableVariationPropertyValue(
                    VariationPlatformParamAdjustmentsTable.vpvId,
                    projectId,
                    systemAdmin,
                ) and ComponentOwnership.readablePlatformParam(
                    VariationPlatformParamAdjustmentsTable.platformParamId,
                    projectId,
                    systemAdmin,
                )
        }.singleOrNull()?.let(::variationAdjustment)

    override suspend fun createVariationAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: ComponentModelRepository.VariationAdjustmentCreate,
    ): VariationPlatformParamAdjustment? {
        if (!canWriteVpv(projectId, systemAdmin, command.vpvId)) return null
        if (!canWritePlatformParam(projectId, systemAdmin, command.platformParamId)) return null
        val designSystemId = VariationPropertyValuesTable.selectAll()
            .where { VariationPropertyValuesTable.id eq command.vpvId }
            .single()[VariationPropertyValuesTable.designSystemId]
        val id = StableVariationPlatformParamAdjustmentsTable.insertReturning {
            it[vpvId] = command.vpvId
            it[platformParamId] = command.platformParamId
            it[StableVariationPlatformParamAdjustmentsTable.designSystemId] = designSystemId
        }.single()[StableVariationPlatformParamAdjustmentsTable.id]
        VariationPlatformParamAdjustmentRevisionsTable.replaceRevision(
            VariationPlatformParamAdjustmentRevisionsTable.entityId,
            id,
            designSystemId,
        ) { statement ->
            statement[value] = command.value
            statement[template] = command.template
        }
        return findVariationAdjustment(projectId, systemAdmin, id)
    }

    @Suppress("ReturnCount")
    override suspend fun updateVariationAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ComponentModelRepository.AdjustmentUpdate,
    ): VariationPlatformParamAdjustment? {
        if (!lockComponentSubject(
                StableVariationPlatformParamAdjustmentsTable,
                StableVariationPlatformParamAdjustmentsTable.id,
                StableVariationPlatformParamAdjustmentsTable.designSystemId,
                "variation-platform-param-adjustment",
                id,
            )
        ) {
            return null
        }
        val existing = VariationPlatformParamAdjustmentsTable.selectAll().where {
            (VariationPlatformParamAdjustmentsTable.id eq id) and
                ComponentOwnership.writableVariationPropertyValue(
                    VariationPlatformParamAdjustmentsTable.vpvId,
                    projectId,
                    systemAdmin,
                ) and ComponentOwnership.writablePlatformParam(
                    VariationPlatformParamAdjustmentsTable.platformParamId,
                    projectId,
                    systemAdmin,
                )
        }.singleOrNull() ?: return null
        val designSystemId = StableVariationPlatformParamAdjustmentsTable.selectAll()
            .where { StableVariationPlatformParamAdjustmentsTable.id eq id }
            .single()[StableVariationPlatformParamAdjustmentsTable.designSystemId]
        val changedPaths = buildSet {
            if (command.valuePresent) add("/value")
            if (command.templatePresent) add("/template")
        }
        if (changedPaths.isEmpty()) return variationAdjustment(existing)
        VariationPlatformParamAdjustmentRevisionsTable.replaceRevision(
            VariationPlatformParamAdjustmentRevisionsTable.entityId,
            id,
            designSystemId,
            changedPaths = changedPaths,
        ) { statement ->
            statement[value] = if (command.valuePresent) {
                command.value
            } else {
                existing[VariationPlatformParamAdjustmentsTable.value]
            }
            statement[template] = if (command.templatePresent) {
                command.template
            } else {
                existing[VariationPlatformParamAdjustmentsTable.template]
            }
        }
        return findVariationAdjustment(projectId, systemAdmin, id)
    }

    override suspend fun deleteVariationAdjustment(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!lockComponentSubject(
                StableVariationPlatformParamAdjustmentsTable,
                StableVariationPlatformParamAdjustmentsTable.id,
                StableVariationPlatformParamAdjustmentsTable.designSystemId,
                "variation-platform-param-adjustment",
                id,
            )
        ) {
            return false
        }
        val existing = VariationPlatformParamAdjustmentsTable.selectAll().where {
            (VariationPlatformParamAdjustmentsTable.id eq id) and
                ComponentOwnership.writableVariationPropertyValue(
                    VariationPlatformParamAdjustmentsTable.vpvId,
                    projectId,
                    systemAdmin,
                ) and ComponentOwnership.writablePlatformParam(
                    VariationPlatformParamAdjustmentsTable.platformParamId,
                    projectId,
                    systemAdmin,
                )
        }.singleOrNull() ?: return false
        val designSystemId = StableVariationPlatformParamAdjustmentsTable.selectAll()
            .where { StableVariationPlatformParamAdjustmentsTable.id eq id }
            .single()[StableVariationPlatformParamAdjustmentsTable.designSystemId]
        VariationPlatformParamAdjustmentRevisionsTable.replaceRevision(
            VariationPlatformParamAdjustmentRevisionsTable.entityId,
            id,
            designSystemId,
            deleted = true,
        )
        return true
    }

    override suspend fun listInvariantAdjustments(
        projectId: ProjectId,
        systemAdmin: Boolean,
    ): List<InvariantPlatformParamAdjustment> = InvariantPlatformParamAdjustmentsTable.selectAll()
        .where {
            ComponentOwnership.readableInvariantPropertyValue(
                InvariantPlatformParamAdjustmentsTable.ipvId,
                projectId,
                systemAdmin,
            ) and ComponentOwnership.readablePlatformParam(
                InvariantPlatformParamAdjustmentsTable.platformParamId,
                projectId,
                systemAdmin,
            )
        }.map(::invariantAdjustment)

    override suspend fun findInvariantAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): InvariantPlatformParamAdjustment? = InvariantPlatformParamAdjustmentsTable.selectAll()
        .where {
            (InvariantPlatformParamAdjustmentsTable.id eq id) and
                ComponentOwnership.readableInvariantPropertyValue(
                    InvariantPlatformParamAdjustmentsTable.ipvId,
                    projectId,
                    systemAdmin,
                ) and ComponentOwnership.readablePlatformParam(
                    InvariantPlatformParamAdjustmentsTable.platformParamId,
                    projectId,
                    systemAdmin,
                )
        }.singleOrNull()?.let(::invariantAdjustment)

    override suspend fun createInvariantAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: ComponentModelRepository.InvariantAdjustmentCreate,
    ): InvariantPlatformParamAdjustment? {
        if (!canWriteIpv(projectId, systemAdmin, command.ipvId)) return null
        if (!canWritePlatformParam(projectId, systemAdmin, command.platformParamId)) return null
        val designSystemId = InvariantPropertyValuesTable.selectAll()
            .where { InvariantPropertyValuesTable.id eq command.ipvId }
            .single()[InvariantPropertyValuesTable.designSystemId]
        val id = StableInvariantPlatformParamAdjustmentsTable.insertReturning {
            it[ipvId] = command.ipvId
            it[platformParamId] = command.platformParamId
            it[StableInvariantPlatformParamAdjustmentsTable.designSystemId] = designSystemId
        }.single()[StableInvariantPlatformParamAdjustmentsTable.id]
        InvariantPlatformParamAdjustmentRevisionsTable.replaceRevision(
            InvariantPlatformParamAdjustmentRevisionsTable.entityId,
            id,
            designSystemId,
        ) { statement ->
            statement[value] = command.value
            statement[template] = command.template
        }
        return findInvariantAdjustment(projectId, systemAdmin, id)
    }

    @Suppress("ReturnCount")
    override suspend fun updateInvariantAdjustment(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ComponentModelRepository.AdjustmentUpdate,
    ): InvariantPlatformParamAdjustment? {
        if (!lockComponentSubject(
                StableInvariantPlatformParamAdjustmentsTable,
                StableInvariantPlatformParamAdjustmentsTable.id,
                StableInvariantPlatformParamAdjustmentsTable.designSystemId,
                "invariant-platform-param-adjustment",
                id,
            )
        ) {
            return null
        }
        val existing = InvariantPlatformParamAdjustmentsTable.selectAll().where {
            (InvariantPlatformParamAdjustmentsTable.id eq id) and
                ComponentOwnership.writableInvariantPropertyValue(
                    InvariantPlatformParamAdjustmentsTable.ipvId,
                    projectId,
                    systemAdmin,
                ) and ComponentOwnership.writablePlatformParam(
                    InvariantPlatformParamAdjustmentsTable.platformParamId,
                    projectId,
                    systemAdmin,
                )
        }.singleOrNull() ?: return null
        val designSystemId = StableInvariantPlatformParamAdjustmentsTable.selectAll()
            .where { StableInvariantPlatformParamAdjustmentsTable.id eq id }
            .single()[StableInvariantPlatformParamAdjustmentsTable.designSystemId]
        val changedPaths = buildSet {
            if (command.valuePresent) add("/value")
            if (command.templatePresent) add("/template")
        }
        if (changedPaths.isEmpty()) return invariantAdjustment(existing)
        InvariantPlatformParamAdjustmentRevisionsTable.replaceRevision(
            InvariantPlatformParamAdjustmentRevisionsTable.entityId,
            id,
            designSystemId,
            changedPaths = changedPaths,
        ) { statement ->
            statement[value] = if (command.valuePresent) {
                command.value
            } else {
                existing[InvariantPlatformParamAdjustmentsTable.value]
            }
            statement[template] = if (command.templatePresent) {
                command.template
            } else {
                existing[InvariantPlatformParamAdjustmentsTable.template]
            }
        }
        return findInvariantAdjustment(projectId, systemAdmin, id)
    }

    override suspend fun deleteInvariantAdjustment(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
        if (!lockComponentSubject(
                StableInvariantPlatformParamAdjustmentsTable,
                StableInvariantPlatformParamAdjustmentsTable.id,
                StableInvariantPlatformParamAdjustmentsTable.designSystemId,
                "invariant-platform-param-adjustment",
                id,
            )
        ) {
            return false
        }
        val existing = InvariantPlatformParamAdjustmentsTable.selectAll().where {
            (InvariantPlatformParamAdjustmentsTable.id eq id) and
                ComponentOwnership.writableInvariantPropertyValue(
                    InvariantPlatformParamAdjustmentsTable.ipvId,
                    projectId,
                    systemAdmin,
                ) and ComponentOwnership.writablePlatformParam(
                    InvariantPlatformParamAdjustmentsTable.platformParamId,
                    projectId,
                    systemAdmin,
                )
        }.singleOrNull() ?: return false
        val designSystemId = StableInvariantPlatformParamAdjustmentsTable.selectAll()
            .where { StableInvariantPlatformParamAdjustmentsTable.id eq id }
            .single()[StableInvariantPlatformParamAdjustmentsTable.designSystemId]
        InvariantPlatformParamAdjustmentRevisionsTable.replaceRevision(
            InvariantPlatformParamAdjustmentRevisionsTable.entityId,
            id,
            designSystemId,
            deleted = true,
        )
        return true
    }
}

private fun variationRow(id: UUID) = VariationsTable.selectAll().where { VariationsTable.id eq id }.singleOrNull()
private fun propertyRow(id: UUID) = PropertiesTable.selectAll().where { PropertiesTable.id eq id }.singleOrNull()
private fun platformParamRow(id: UUID) = PropertyPlatformParamsTable.selectAll()
    .where { PropertyPlatformParamsTable.id eq id }.singleOrNull()

private fun readableDesignSystemIds(projectId: ProjectId, systemAdmin: Boolean): List<UUID> =
    if (systemAdmin) {
        ComponentDesignSystemsTable.selectAll().map { it[ComponentDesignSystemsTable.id] }
    } else {
        com.dsbuilder.ds.components.data.readableDesignSystemIds(projectId)
    }

private fun variationModel(row: ResultRow) = ComponentVariationSummary(
    row[VariationsTable.id],
    row[VariationsTable.componentId],
    row[VariationsTable.designSystemId],
    row[VariationsTable.name],
    row[VariationsTable.description],
    row[VariationsTable.createdAt],
    row[VariationsTable.updatedAt],
)

private fun propertyModel(row: ResultRow) = ComponentPropertySummary(
    row[PropertiesTable.id],
    row[PropertiesTable.componentId],
    row[PropertiesTable.name],
    row[PropertiesTable.type].wireValue,
    row[PropertiesTable.defaultValue],
    row[PropertiesTable.description],
    row[PropertiesTable.createdAt],
    row[PropertiesTable.updatedAt],
)

private fun componentStyle(row: ResultRow) = ComponentStyleSummary(
    row[ComponentStylesTable.id],
    row[ComponentStylesTable.designSystemId],
    row[ComponentStylesTable.variationId],
    row[ComponentStylesTable.name],
    row[ComponentStylesTable.description],
    row[ComponentStylesTable.createdAt],
    row[ComponentStylesTable.updatedAt],
)

private fun platformParam(row: ResultRow) = PropertyPlatformParam(
    row[PropertyPlatformParamsTable.id],
    row[PropertyPlatformParamsTable.propertyId],
    row[PropertyPlatformParamsTable.platform].wireValue,
    row[PropertyPlatformParamsTable.name],
    row[PropertyPlatformParamsTable.deprecated],
    row[PropertyPlatformParamsTable.deprecatedMessage],
    row[PropertyPlatformParamsTable.createdAt],
    row[PropertyPlatformParamsTable.updatedAt],
)

private fun propertyVariation(row: ResultRow) = PropertyVariation(
    row[PropertyVariationsTable.id],
    row[PropertyVariationsTable.propertyId],
    row[PropertyVariationsTable.variationId],
    row[PropertyVariationsTable.createdAt],
    row[PropertyVariationsTable.updatedAt],
)

private fun variationAdjustment(row: ResultRow) = VariationPlatformParamAdjustment(
    row[VariationPlatformParamAdjustmentsTable.id],
    row[VariationPlatformParamAdjustmentsTable.vpvId],
    row[VariationPlatformParamAdjustmentsTable.platformParamId],
    row[VariationPlatformParamAdjustmentsTable.value],
    row[VariationPlatformParamAdjustmentsTable.template],
    row[VariationPlatformParamAdjustmentsTable.createdAt],
    row[VariationPlatformParamAdjustmentsTable.updatedAt],
)

private fun invariantAdjustment(row: ResultRow) = InvariantPlatformParamAdjustment(
    row[InvariantPlatformParamAdjustmentsTable.id],
    row[InvariantPlatformParamAdjustmentsTable.ipvId],
    row[InvariantPlatformParamAdjustmentsTable.platformParamId],
    row[InvariantPlatformParamAdjustmentsTable.value],
    row[InvariantPlatformParamAdjustmentsTable.template],
    row[InvariantPlatformParamAdjustmentsTable.createdAt],
    row[InvariantPlatformParamAdjustmentsTable.updatedAt],
)

private fun canReadVariationAdjustment(
    projectId: ProjectId,
    systemAdmin: Boolean,
    value: VariationPlatformParamAdjustment,
): Boolean = canReadVpv(projectId, systemAdmin, value.vpvId) &&
    canReadPlatformParam(projectId, systemAdmin, value.platformParamId)

private fun canReadInvariantAdjustment(
    projectId: ProjectId,
    systemAdmin: Boolean,
    value: InvariantPlatformParamAdjustment,
): Boolean = canReadIpv(projectId, systemAdmin, value.ipvId) &&
    canReadPlatformParam(projectId, systemAdmin, value.platformParamId)

private fun canReadPlatformParam(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean =
    platformParamRow(id)?.get(PropertyPlatformParamsTable.propertyId)
        ?.let { ComponentOwnership.canReadProperty(projectId, systemAdmin, it) } == true

private fun canWritePlatformParam(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean =
    platformParamRow(id)?.get(PropertyPlatformParamsTable.propertyId)
        ?.let { ComponentOwnership.canWriteProperty(projectId, systemAdmin, it) } == true

private fun canReadVpv(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
    val row = VariationPropertyValuesTable.selectAll().where { VariationPropertyValuesTable.id eq id }
        .singleOrNull() ?: return false
    val styleId = row[VariationPropertyValuesTable.styleId]
    val designSystemId = ComponentStylesTable.selectAll().where { ComponentStylesTable.id eq styleId }
        .singleOrNull()?.get(ComponentStylesTable.designSystemId) ?: return false
    return ComponentOwnership.canReadDesignSystem(projectId, systemAdmin, designSystemId) &&
        ComponentOwnership.canReadProperty(projectId, systemAdmin, row[VariationPropertyValuesTable.propertyId])
}

private fun canWriteVpv(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
    val row = VariationPropertyValuesTable.selectAll().where { VariationPropertyValuesTable.id eq id }
        .singleOrNull() ?: return false
    val styleId = row[VariationPropertyValuesTable.styleId]
    val designSystemId = ComponentStylesTable.selectAll().where { ComponentStylesTable.id eq styleId }
        .singleOrNull()?.get(ComponentStylesTable.designSystemId) ?: return false
    return ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, designSystemId) &&
        ComponentOwnership.canWriteProperty(projectId, systemAdmin, row[VariationPropertyValuesTable.propertyId])
}

private fun canReadIpv(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
    val row = InvariantPropertyValuesTable.selectAll().where { InvariantPropertyValuesTable.id eq id }
        .singleOrNull() ?: return false
    return ComponentOwnership.canReadDesignSystem(
        projectId,
        systemAdmin,
        row[InvariantPropertyValuesTable.designSystemId],
    ) && row[InvariantPropertyValuesTable.componentId] in
        ComponentOwnership.readableComponentIds(projectId, systemAdmin)
}

private fun canWriteIpv(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Boolean {
    val row = InvariantPropertyValuesTable.selectAll().where { InvariantPropertyValuesTable.id eq id }
        .singleOrNull() ?: return false
    return ComponentOwnership.canWriteDesignSystem(
        projectId,
        systemAdmin,
        row[InvariantPropertyValuesTable.designSystemId],
    ) && row[InvariantPropertyValuesTable.componentId] in
        ComponentOwnership.writableComponentIds(projectId, systemAdmin)
}
