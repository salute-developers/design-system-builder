package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.data.ExposedDraftChangeHandler
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.Table
import java.util.UUID

/** Предметные обработчики журнала конфигурации компонентов. */
@Suppress("LongMethod") // Декларативный закрытый перечень предметных таблиц лучше проверяется целиком.
internal fun componentDraftChangeHandlers(): List<DraftChangeHandler> = listOf(
    componentHandler(
        "design-system-component",
        StableDesignSystemComponentsTable,
        StableDesignSystemComponentsTable.id,
        StableDesignSystemComponentsTable.designSystemId,
        DesignSystemComponentRevisionsTable,
        DesignSystemComponentRevisionsTable.entityId,
        stableValues = listOf(StableDesignSystemComponentsTable.componentId),
    ),
    componentHandler(
        "appearance",
        StableAppearancesTable,
        StableAppearancesTable.id,
        StableAppearancesTable.designSystemId,
        AppearanceRevisionsTable,
        AppearanceRevisionsTable.entityId,
        stableValues = listOf(StableAppearancesTable.componentId),
        revisionValues = listOf(
            AppearanceRevisionsTable.name,
            AppearanceRevisionsTable.rootVariationId,
            AppearanceRevisionsTable.colorSchemeVariationId,
        ),
    ),
    componentHandler(
        "style",
        StableStylesTable,
        StableStylesTable.id,
        StableStylesTable.designSystemId,
        StyleRevisionsTable,
        StyleRevisionsTable.entityId,
        stableValues = listOf(StableStylesTable.variationId),
        revisionValues = listOf(StyleRevisionsTable.name, StyleRevisionsTable.description),
    ),
    componentHandler(
        "component-reuse-config",
        StableComponentReuseConfigsTable,
        StableComponentReuseConfigsTable.id,
        StableComponentReuseConfigsTable.designSystemId,
        ComponentReuseConfigRevisionsTable,
        ComponentReuseConfigRevisionsTable.entityId,
        stableValues = listOf(StableComponentReuseConfigsTable.componentDepId),
        revisionValues = listOf(
            ComponentReuseConfigRevisionsTable.appearanceId,
            ComponentReuseConfigRevisionsTable.variationId,
            ComponentReuseConfigRevisionsTable.styleId,
        ),
    ),
    componentHandler(
        "appearance-variation",
        StableAppearanceVariationsTable,
        StableAppearanceVariationsTable.id,
        StableAppearanceVariationsTable.designSystemId,
        AppearanceVariationRevisionsTable,
        AppearanceVariationRevisionsTable.entityId,
        stableValues = listOf(
            StableAppearanceVariationsTable.appearanceId,
            StableAppearanceVariationsTable.variationId,
        ),
        revisionValues = listOf(
            AppearanceVariationRevisionsTable.position,
            AppearanceVariationRevisionsTable.defaultStyleId,
            AppearanceVariationRevisionsTable.declaredType,
        ),
    ),
    componentHandler(
        "appearance-variation-value",
        StableAppearanceVariationValuesTable,
        StableAppearanceVariationValuesTable.id,
        StableAppearanceVariationValuesTable.designSystemId,
        AppearanceVariationValueRevisionsTable,
        AppearanceVariationValueRevisionsTable.entityId,
        stableValues = listOf(StableAppearanceVariationValuesTable.appearanceVariationId),
        revisionValues = listOf(
            AppearanceVariationValueRevisionsTable.styleId,
            AppearanceVariationValueRevisionsTable.position,
            AppearanceVariationValueRevisionsTable.authoredId,
        ),
    ),
    componentHandler(
        "appearance-combination",
        StableAppearanceCombinationsTable,
        StableAppearanceCombinationsTable.id,
        StableAppearanceCombinationsTable.designSystemId,
        AppearanceCombinationRevisionsTable,
        AppearanceCombinationRevisionsTable.entityId,
        stableValues = listOf(StableAppearanceCombinationsTable.appearanceId),
        revisionValues = listOf(
            AppearanceCombinationRevisionsTable.combinationKey,
            AppearanceCombinationRevisionsTable.position,
            AppearanceCombinationRevisionsTable.authoredId,
        ),
    ),
    componentHandler(
        "appearance-combination-member",
        StableAppearanceCombinationMembersTable,
        StableAppearanceCombinationMembersTable.id,
        StableAppearanceCombinationMembersTable.designSystemId,
        AppearanceCombinationMemberRevisionsTable,
        AppearanceCombinationMemberRevisionsTable.entityId,
        stableValues = listOf(StableAppearanceCombinationMembersTable.appearanceCombinationId),
        revisionValues = listOf(
            AppearanceCombinationMemberRevisionsTable.styleId,
            AppearanceCombinationMemberRevisionsTable.position,
        ),
    ),
    componentHandler(
        "invariant-property-value",
        StableInvariantPropertyValuesTable,
        StableInvariantPropertyValuesTable.id,
        StableInvariantPropertyValuesTable.designSystemId,
        InvariantPropertyValueRevisionsTable,
        InvariantPropertyValueRevisionsTable.entityId,
        stableValues = listOf(
            StableInvariantPropertyValuesTable.propertyId,
            StableInvariantPropertyValuesTable.componentId,
            StableInvariantPropertyValuesTable.appearanceId,
        ),
        revisionValues = propertyValueColumns(InvariantPropertyValueRevisionsTable),
    ),
    componentHandler(
        "invariant-platform-param-adjustment",
        StableInvariantPlatformParamAdjustmentsTable,
        StableInvariantPlatformParamAdjustmentsTable.id,
        StableInvariantPlatformParamAdjustmentsTable.designSystemId,
        InvariantPlatformParamAdjustmentRevisionsTable,
        InvariantPlatformParamAdjustmentRevisionsTable.entityId,
        stableValues = listOf(
            StableInvariantPlatformParamAdjustmentsTable.ipvId,
            StableInvariantPlatformParamAdjustmentsTable.platformParamId,
        ),
        revisionValues = listOf(
            InvariantPlatformParamAdjustmentRevisionsTable.value,
            InvariantPlatformParamAdjustmentRevisionsTable.template,
        ),
    ),
    componentHandler(
        "variation-property-value",
        StableVariationPropertyValuesTable,
        StableVariationPropertyValuesTable.id,
        StableVariationPropertyValuesTable.designSystemId,
        VariationPropertyValueRevisionsTable,
        VariationPropertyValueRevisionsTable.entityId,
        stableValues = listOf(
            StableVariationPropertyValuesTable.propertyId,
            StableVariationPropertyValuesTable.styleId,
            StableVariationPropertyValuesTable.appearanceId,
        ),
        revisionValues = propertyValueColumns(VariationPropertyValueRevisionsTable),
    ),
    componentHandler(
        "variation-platform-param-adjustment",
        StableVariationPlatformParamAdjustmentsTable,
        StableVariationPlatformParamAdjustmentsTable.id,
        StableVariationPlatformParamAdjustmentsTable.designSystemId,
        VariationPlatformParamAdjustmentRevisionsTable,
        VariationPlatformParamAdjustmentRevisionsTable.entityId,
        stableValues = listOf(
            StableVariationPlatformParamAdjustmentsTable.vpvId,
            StableVariationPlatformParamAdjustmentsTable.platformParamId,
        ),
        revisionValues = listOf(
            VariationPlatformParamAdjustmentRevisionsTable.value,
            VariationPlatformParamAdjustmentRevisionsTable.template,
        ),
    ),
    componentHandler(
        "style-combination",
        StableStyleCombinationsTable,
        StableStyleCombinationsTable.id,
        StableStyleCombinationsTable.designSystemId,
        StyleCombinationRevisionsTable,
        StyleCombinationRevisionsTable.entityId,
        stableValues = listOf(
            StableStyleCombinationsTable.propertyId,
            StableStyleCombinationsTable.appearanceId,
        ),
        revisionValues = listOf(
            StyleCombinationRevisionsTable.combinationKey,
            StyleCombinationRevisionsTable.value,
            StyleCombinationRevisionsTable.tokenId,
            StyleCombinationRevisionsTable.alpha,
            StyleCombinationRevisionsTable.adjustment,
            StyleCombinationRevisionsTable.position,
            StyleCombinationRevisionsTable.stateSetId,
        ),
    ),
    componentHandler(
        "style-combination-member",
        StableStyleCombinationMembersTable,
        StableStyleCombinationMembersTable.id,
        StableStyleCombinationMembersTable.designSystemId,
        StyleCombinationMemberRevisionsTable,
        StyleCombinationMemberRevisionsTable.entityId,
        stableValues = listOf(StableStyleCombinationMembersTable.combinationId),
        revisionValues = listOf(StyleCombinationMemberRevisionsTable.styleId),
    ),
    componentHandler(
        "component-style-reference",
        StableComponentStyleReferencesTable,
        StableComponentStyleReferencesTable.id,
        StableComponentStyleReferencesTable.designSystemId,
        ComponentStyleReferenceRevisionsTable,
        ComponentStyleReferenceRevisionsTable.entityId,
        revisionValues = listOf(
            ComponentStyleReferenceRevisionsTable.invariantPropertyValueId,
            ComponentStyleReferenceRevisionsTable.variationPropertyValueId,
            ComponentStyleReferenceRevisionsTable.styleCombinationId,
            ComponentStyleReferenceRevisionsTable.targetAppearanceId,
            ComponentStyleReferenceRevisionsTable.reference,
        ),
    ),
    componentHandler(
        "component-style-reference-style",
        StableComponentStyleReferenceStylesTable,
        StableComponentStyleReferenceStylesTable.id,
        StableComponentStyleReferenceStylesTable.designSystemId,
        ComponentStyleReferenceStyleRevisionsTable,
        ComponentStyleReferenceStyleRevisionsTable.entityId,
        stableValues = listOf(StableComponentStyleReferenceStylesTable.referenceId),
        revisionValues = listOf(ComponentStyleReferenceStyleRevisionsTable.styleId),
    ),
)

private fun componentHandler(
    type: String,
    stable: Table,
    stableId: Column<UUID>,
    designSystemId: Column<UUID>,
    revision: ComponentRevisionTable,
    revisionEntityId: Column<UUID>,
    stableValues: List<Column<*>> = emptyList(),
    revisionValues: List<Column<*>> = emptyList(),
): DraftChangeHandler = ExposedDraftChangeHandler(
    entityType = type,
    stableTable = stable,
    stableId = stableId,
    stableDesignSystemId = designSystemId,
    revisionTable = revision,
    revisionEntityId = revisionEntityId,
    revisionVersionId = revision.designSystemVersionId,
    revisionSequenceNumber = revision.versionSequenceNumber,
    revisionDeleted = revision.deleted,
    stableValueColumns = stableValues,
    revisionValueColumns = revisionValues,
)

private fun propertyValueColumns(table: InvariantPropertyValueRevisionsTable): List<Column<*>> = listOf(
    table.tokenId,
    table.value,
    table.alpha,
    table.adjustment,
    table.position,
    table.stateSetId,
)

private fun propertyValueColumns(table: VariationPropertyValueRevisionsTable): List<Column<*>> = listOf(
    table.tokenId,
    table.value,
    table.alpha,
    table.adjustment,
    table.position,
    table.stateSetId,
)
