@file:Suppress("MaxLineLength", "MultiLineIfElse", "ktlint:standard:max-line-length")

package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.Expression
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inSubQuery
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.core.notInSubQuery
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.Query
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** SQL ownership predicates. Each predicate scopes the resource in the statement that uses it. */
internal object ComponentOwnership {
    fun readableDesignSystem(c: Expression<UUID>, p: ProjectId, admin: Boolean) = scope(admin, c, readableDs(p))
    fun writableDesignSystem(c: Expression<UUID>, p: ProjectId, admin: Boolean) = scope(admin, c, writableDs(p))
    fun readableComponent(c: Expression<UUID>, p: ProjectId, admin: Boolean) = scope(admin, c, readableComponents(p))
    fun writableComponent(c: Expression<UUID>, p: ProjectId, admin: Boolean): Op<Boolean> = if (admin) {
        Op.TRUE
    } else {
        (c inSubQuery writableComponentIds(p)) and (c notInSubQuery foreignComponents(p))
    }
    fun readableVariation(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, variations(readableComponents(p)))
    fun writableVariation(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, variations(writableComponentIds(p)))
    fun readableProperty(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, properties(readableComponents(p)))
    fun writableProperty(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, properties(writableComponentIds(p)))
    fun readableAppearance(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, appearances(readableDs(p), readableComponents(p)))
    fun writableAppearance(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, appearances(writableDs(p), writableComponentIds(p)))
    fun readableAppearanceVariation(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, appearanceVariations(readableAppearanceIds(p)))
    fun writableAppearanceVariation(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, appearanceVariations(writableAppearanceIds(p)))
    fun readableAppearanceVariationValue(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, appearanceVariationValues(readableAppearanceVariationIds(p)))
    fun writableAppearanceVariationValue(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, appearanceVariationValues(writableAppearanceVariationIds(p)))
    fun readableStyle(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, styles(readableDs(p), readableVariationIds(p)))
    fun writableStyle(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, styles(writableDs(p), writableVariationIds(p)))
    fun readableStateSet(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, stateSets(readableComponents(p)))
    fun readableState(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, states(readableComponents(p)))
    fun readableStyleCombination(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, combinations(readablePropertyIds(p), readableAppearanceIds(p)))
    fun writableStyleCombination(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, combinations(writablePropertyIds(p), writableAppearanceIds(p)))
    fun readableStyleCombinationMember(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, members(readableCombinationIds(p), readableStyleIds(p)))
    fun writableStyleCombinationMember(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, members(writableCombinationIds(p), writableStyleIds(p)))
    fun readablePlatformParam(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, platformParams(readablePropertyIds(p)))
    fun writablePlatformParam(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, platformParams(writablePropertyIds(p)))
    fun readablePropertyVariation(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, propertyVariations(readablePropertyIds(p), readableVariationIds(p)))
    fun writablePropertyVariation(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, propertyVariations(writablePropertyIds(p), writableVariationIds(p)))
    fun readableVariationPropertyValue(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, vpvs(readablePropertyIds(p), readableStyleIds(p), readableAppearanceIds(p)))
    fun writableVariationPropertyValue(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, vpvs(writablePropertyIds(p), writableStyleIds(p), writableAppearanceIds(p)))
    fun readableInvariantPropertyValue(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, ipvs(readablePropertyIds(p), readableDs(p), readableComponents(p), readableAppearanceIds(p)))
    fun writableInvariantPropertyValue(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, ipvs(writablePropertyIds(p), writableDs(p), writableComponentIds(p), writableAppearanceIds(p)))
    fun readableVariationAdjustment(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, variationAdjustments(readableVpvIds(p), readablePlatformParamIds(p)))
    fun writableVariationAdjustment(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, variationAdjustments(writableVpvIds(p), writablePlatformParamIds(p)))
    fun readableInvariantAdjustment(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, invariantAdjustments(readableIpvIds(p), readablePlatformParamIds(p)))
    fun writableInvariantAdjustment(
        c: Expression<UUID>,
        p: ProjectId,
        admin: Boolean,
    ) = scope(admin, c, invariantAdjustments(writableIpvIds(p), writablePlatformParamIds(p)))

    fun readableComponentIds(p: ProjectId, admin: Boolean): Set<UUID> = if (admin) {
        ComponentsTable.selectAll().mapTo(
            linkedSetOf(),
        ) {
            it[ComponentsTable.id]
        }
    } else {
        readableComponents(p).mapTo(linkedSetOf()) { it[DesignSystemComponentsTable.componentId] }
    }
    fun writableComponentIds(
        p: ProjectId,
        admin: Boolean,
    ): Set<UUID> = if (admin) {
        ComponentsTable.selectAll().mapTo(linkedSetOf()) {
            it[ComponentsTable.id]
        }
    } else {
        writableComponentIds(p).mapTo(linkedSetOf()) { it[DesignSystemComponentsTable.componentId] }
    }

    fun canReadDesignSystem(p: ProjectId, a: Boolean, id: UUID) = ComponentDesignSystemsTable.selectAll().where {
        (ComponentDesignSystemsTable.id eq id) and readableDesignSystem(ComponentDesignSystemsTable.id, p, a)
    }.any()
    fun canWriteDesignSystem(
        p: ProjectId,
        a: Boolean,
        id: UUID,
    ) = ComponentDesignSystemsTable.selectAll().where {
        (ComponentDesignSystemsTable.id eq id) and writableDesignSystem(ComponentDesignSystemsTable.id, p, a)
    }.any()
    fun canReadVariation(
        p: ProjectId,
        a: Boolean,
        id: UUID,
    ) = VariationsTable.selectAll().where {
        (VariationsTable.id eq id) and readableVariation(VariationsTable.id, p, a)
    }.any()
    fun canWriteVariation(
        p: ProjectId,
        a: Boolean,
        id: UUID,
    ) = VariationsTable.selectAll().where {
        (VariationsTable.id eq id) and writableVariation(VariationsTable.id, p, a)
    }.any()
    fun canReadProperty(
        p: ProjectId,
        a: Boolean,
        id: UUID,
    ) = PropertiesTable.selectAll().where {
        (PropertiesTable.id eq id) and readableProperty(PropertiesTable.id, p, a)
    }.any()
    fun canWriteProperty(
        p: ProjectId,
        a: Boolean,
        id: UUID,
    ) = PropertiesTable.selectAll().where {
        (PropertiesTable.id eq id) and writableProperty(PropertiesTable.id, p, a)
    }.any()
    fun canReadAppearance(
        p: ProjectId,
        a: Boolean,
        id: UUID,
    ) = ComponentAppearancesTable.selectAll().where {
        (ComponentAppearancesTable.id eq id) and readableAppearance(ComponentAppearancesTable.id, p, a)
    }.any()
    fun canWriteAppearance(
        p: ProjectId,
        a: Boolean,
        id: UUID,
    ) = ComponentAppearancesTable.selectAll().where {
        (ComponentAppearancesTable.id eq id) and writableAppearance(ComponentAppearancesTable.id, p, a)
    }.any()
    fun canReadStyle(
        p: ProjectId,
        a: Boolean,
        id: UUID,
    ) = ComponentStylesTable.selectAll().where {
        (ComponentStylesTable.id eq id) and readableStyle(ComponentStylesTable.id, p, a)
    }.any()
    fun canWriteStyle(
        p: ProjectId,
        a: Boolean,
        id: UUID,
    ) = ComponentStylesTable.selectAll().where {
        (ComponentStylesTable.id eq id) and writableStyle(ComponentStylesTable.id, p, a)
    }.any()
    fun canReadStateSet(
        p: ProjectId,
        a: Boolean,
        id: UUID,
    ) = ComponentStateSetsTable.selectAll().where {
        (ComponentStateSetsTable.id eq id) and readableStateSet(ComponentStateSetsTable.id, p, a)
    }.any()
    fun canReadDependency(p: ProjectId, a: Boolean, id: UUID) = ComponentDependenciesTable.selectAll().where {
        (ComponentDependenciesTable.id eq id) and readableComponent(ComponentDependenciesTable.parentId, p, a) and readableComponent(ComponentDependenciesTable.childId, p, a)
    }.any()
    fun canWriteDependency(p: ProjectId, a: Boolean, id: UUID) = ComponentDependenciesTable.selectAll().where {
        (ComponentDependenciesTable.id eq id) and writableComponent(ComponentDependenciesTable.parentId, p, a) and writableComponent(ComponentDependenciesTable.childId, p, a)
    }.any()
    fun canReadToken(p: ProjectId, a: Boolean, id: UUID) = if (a) {
        true
    } else {
        ComponentTokensTable.selectAll().where {
            (ComponentTokensTable.id eq id) and
                (ComponentTokensTable.designSystemId.isNull() or (ComponentTokensTable.designSystemId inSubQuery readableDs(p)))
        }.any()
    }

    private fun scope(admin: Boolean, c: Expression<UUID>, ids: Query): Op<Boolean> = if (admin) Op.TRUE else c inSubQuery ids
    private fun readableDs(
        p: ProjectId,
    ) = ComponentDesignSystemsTable.select(ComponentDesignSystemsTable.id).where {
        (ComponentDesignSystemsTable.projectId eq p.value) or ComponentDesignSystemsTable.projectId.isNull()
    }
    private fun writableDs(
        p: ProjectId,
    ) = ComponentDesignSystemsTable.select(ComponentDesignSystemsTable.id).where {
        ComponentDesignSystemsTable.projectId eq p.value
    }
    private fun readableComponents(
        p: ProjectId,
    ) = DesignSystemComponentsTable.select(DesignSystemComponentsTable.componentId).where {
        DesignSystemComponentsTable.designSystemId inSubQuery readableDs(p)
    }
    private fun writableComponents(
        p: ProjectId,
    ) = DesignSystemComponentsTable.select(DesignSystemComponentsTable.componentId).where {
        DesignSystemComponentsTable.designSystemId inSubQuery writableDs(p)
    }
    private fun foreignComponents(
        p: ProjectId,
    ) = DesignSystemComponentsTable.innerJoin(
        ComponentDesignSystemsTable,
    ).select(DesignSystemComponentsTable.componentId).where {
        (ComponentDesignSystemsTable.projectId neq p.value) or ComponentDesignSystemsTable.projectId.isNull()
    }
    private fun writableComponentIds(
        p: ProjectId,
    ) = writableComponents(p).adjustWhere { DesignSystemComponentsTable.componentId notInSubQuery foreignComponents(p) }
    private fun variations(
        c: Query,
    ) = VariationsTable.select(VariationsTable.id).where { VariationsTable.componentId inSubQuery c }
    private fun properties(
        c: Query,
    ) = PropertiesTable.select(PropertiesTable.id).where { PropertiesTable.componentId inSubQuery c }
    private fun appearances(
        d: Query,
        c: Query,
    ) = ComponentAppearancesTable.select(ComponentAppearancesTable.id).where {
        (ComponentAppearancesTable.designSystemId inSubQuery d) and (ComponentAppearancesTable.componentId inSubQuery c)
    }
    private fun appearanceVariations(
        a: Query,
    ) = AppearanceVariationsTable.select(AppearanceVariationsTable.id).where {
        AppearanceVariationsTable.appearanceId inSubQuery a
    }
    private fun appearanceVariationValues(
        a: Query,
    ) = AppearanceVariationValuesTable.select(AppearanceVariationValuesTable.id).where {
        AppearanceVariationValuesTable.appearanceVariationId inSubQuery a
    }
    private fun styles(
        d: Query,
        v: Query,
    ) = ComponentStylesTable.select(ComponentStylesTable.id).where {
        (ComponentStylesTable.designSystemId inSubQuery d) and (ComponentStylesTable.variationId inSubQuery v)
    }
    private fun stateSets(
        c: Query,
    ) = ComponentStateSetsTable.select(ComponentStateSetsTable.id).where {
        ComponentStateSetsTable.ownerComponentId.isNull() or (ComponentStateSetsTable.ownerComponentId inSubQuery c)
    }
    private fun states(
        c: Query,
    ) = ComponentStatesTable.select(ComponentStatesTable.id).where {
        ComponentStatesTable.componentId.isNull() or (ComponentStatesTable.componentId inSubQuery c)
    }
    private fun combinations(
        p: Query,
        a: Query,
    ) = StyleCombinationsTable.select(StyleCombinationsTable.id).where {
        (StyleCombinationsTable.propertyId inSubQuery p) and (StyleCombinationsTable.appearanceId inSubQuery a)
    }
    private fun members(
        c: Query,
        s: Query,
    ) = StyleCombinationMembersTable.select(StyleCombinationMembersTable.id).where {
        (StyleCombinationMembersTable.combinationId inSubQuery c) and (StyleCombinationMembersTable.styleId inSubQuery s)
    }
    private fun platformParams(
        p: Query,
    ) = PropertyPlatformParamsTable.select(PropertyPlatformParamsTable.id).where {
        PropertyPlatformParamsTable.propertyId inSubQuery p
    }
    private fun propertyVariations(
        p: Query,
        v: Query,
    ) = PropertyVariationsTable.select(PropertyVariationsTable.id).where {
        (PropertyVariationsTable.propertyId inSubQuery p) and (PropertyVariationsTable.variationId inSubQuery v)
    }
    private fun vpvs(
        p: Query,
        s: Query,
        a: Query,
    ) = VariationPropertyValuesTable.select(VariationPropertyValuesTable.id).where {
        (VariationPropertyValuesTable.propertyId inSubQuery p) and (VariationPropertyValuesTable.styleId inSubQuery s) and (VariationPropertyValuesTable.appearanceId inSubQuery a)
    }
    private fun ipvs(
        p: Query,
        d: Query,
        c: Query,
        a: Query,
    ) = InvariantPropertyValuesTable.select(InvariantPropertyValuesTable.id).where {
        (InvariantPropertyValuesTable.propertyId inSubQuery p) and (InvariantPropertyValuesTable.designSystemId inSubQuery d) and (InvariantPropertyValuesTable.componentId inSubQuery c) and (InvariantPropertyValuesTable.appearanceId inSubQuery a)
    }
    private fun variationAdjustments(
        v: Query,
        p: Query,
    ) = VariationPlatformParamAdjustmentsTable.select(VariationPlatformParamAdjustmentsTable.id).where {
        (VariationPlatformParamAdjustmentsTable.vpvId inSubQuery v) and (VariationPlatformParamAdjustmentsTable.platformParamId inSubQuery p)
    }
    private fun invariantAdjustments(
        v: Query,
        p: Query,
    ) = InvariantPlatformParamAdjustmentsTable.select(InvariantPlatformParamAdjustmentsTable.id).where {
        (InvariantPlatformParamAdjustmentsTable.ipvId inSubQuery v) and (InvariantPlatformParamAdjustmentsTable.platformParamId inSubQuery p)
    }
    private fun readableVariationIds(p: ProjectId) = variations(readableComponents(p))
    private fun writableVariationIds(p: ProjectId) = variations(writableComponentIds(p))
    private fun readablePropertyIds(p: ProjectId) = properties(readableComponents(p))
    private fun writablePropertyIds(p: ProjectId) = properties(writableComponentIds(p))
    private fun readableAppearanceIds(p: ProjectId) = appearances(readableDs(p), readableComponents(p))
    private fun writableAppearanceIds(p: ProjectId) = appearances(writableDs(p), writableComponentIds(p))
    private fun readableAppearanceVariationIds(p: ProjectId) = appearanceVariations(readableAppearanceIds(p))
    private fun writableAppearanceVariationIds(p: ProjectId) = appearanceVariations(writableAppearanceIds(p))
    private fun readableStyleIds(p: ProjectId) = styles(readableDs(p), readableVariationIds(p))
    private fun writableStyleIds(p: ProjectId) = styles(writableDs(p), writableVariationIds(p))
    private fun readableCombinationIds(p: ProjectId) = combinations(readablePropertyIds(p), readableAppearanceIds(p))
    private fun writableCombinationIds(p: ProjectId) = combinations(writablePropertyIds(p), writableAppearanceIds(p))
    private fun readablePlatformParamIds(p: ProjectId) = platformParams(readablePropertyIds(p))
    private fun writablePlatformParamIds(p: ProjectId) = platformParams(writablePropertyIds(p))
    private fun readableVpvIds(
        p: ProjectId,
    ) = vpvs(readablePropertyIds(p), readableStyleIds(p), readableAppearanceIds(p))
    private fun writableVpvIds(
        p: ProjectId,
    ) = vpvs(writablePropertyIds(p), writableStyleIds(p), writableAppearanceIds(p))
    private fun readableIpvIds(
        p: ProjectId,
    ) = ipvs(readablePropertyIds(p), readableDs(p), readableComponents(p), readableAppearanceIds(p))
    private fun writableIpvIds(
        p: ProjectId,
    ) = ipvs(writablePropertyIds(p), writableDs(p), writableComponentIds(p), writableAppearanceIds(p))
}
