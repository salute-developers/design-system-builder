package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.jdbc.insertReturning
import java.util.UUID

/** Записи редакций, общие для операций редактора оформления: создание объявлений и tombstone-удаления. */
@Suppress("TooManyFunctions")
internal object EditorWrites {
    /** Создаёт стиль дизайн-системы для вариации каталога. */
    fun newStyle(designSystemId: UUID, variationId: UUID, name: String): UUID {
        val id = StableStylesTable.insertReturning {
            it[StableStylesTable.designSystemId] = designSystemId
            it[StableStylesTable.variationId] = variationId
        }.single()[StableStylesTable.id]
        StyleRevisionsTable.replaceRevision(StyleRevisionsTable.entityId, id, designSystemId) {
            it[StyleRevisionsTable.name] = name
            it[description] = null
        }
        return id
    }

    /** Создаёт объявление оси в оформлении. */
    fun newAxis(
        designSystemId: UUID,
        appearanceId: UUID,
        variationId: UUID,
        position: Int,
        defaultStyleId: UUID?,
        declaredType: String?,
        displayName: String?,
    ): UUID {
        val id = StableAppearanceVariationsTable.insertReturning {
            it[StableAppearanceVariationsTable.appearanceId] = appearanceId
            it[StableAppearanceVariationsTable.variationId] = variationId
            it[StableAppearanceVariationsTable.designSystemId] = designSystemId
        }.single()[StableAppearanceVariationsTable.id]
        AppearanceVariationRevisionsTable.replaceRevision(
            AppearanceVariationRevisionsTable.entityId,
            id,
            designSystemId,
        ) {
            it[AppearanceVariationRevisionsTable.position] = position
            it[AppearanceVariationRevisionsTable.defaultStyleId] = defaultStyleId
            it[AppearanceVariationRevisionsTable.declaredType] = declaredType
            it[AppearanceVariationRevisionsTable.displayName] = displayName
        }
        return id
    }

    /** Создаёт объявление значения оси. */
    fun newAxisValue(
        designSystemId: UUID,
        axisId: UUID,
        styleId: UUID,
        position: Int,
        authoredId: String?,
        displayName: String?,
    ): UUID {
        val id = StableAppearanceVariationValuesTable.insertReturning {
            it[appearanceVariationId] = axisId
            it[StableAppearanceVariationValuesTable.designSystemId] = designSystemId
        }.single()[StableAppearanceVariationValuesTable.id]
        AppearanceVariationValueRevisionsTable.replaceRevision(
            AppearanceVariationValueRevisionsTable.entityId,
            id,
            designSystemId,
        ) {
            it[AppearanceVariationValueRevisionsTable.styleId] = styleId
            it[AppearanceVariationValueRevisionsTable.position] = position
            it[AppearanceVariationValueRevisionsTable.authoredId] = authoredId
            it[AppearanceVariationValueRevisionsTable.displayName] = displayName
        }
        return id
    }

    /** Меняет позицию оси, сохраняя остальные поля. */
    fun moveAxis(designSystemId: UUID, row: ResultRow, position: Int) {
        if (row[AppearanceVariationsTable.position] == position) return
        AppearanceVariationRevisionsTable.replaceRevision(
            AppearanceVariationRevisionsTable.entityId,
            row[AppearanceVariationsTable.id],
            designSystemId,
            changedPaths = setOf("/position"),
        ) {
            it[AppearanceVariationRevisionsTable.position] = position
            it[defaultStyleId] = row[AppearanceVariationsTable.defaultStyleId]
            it[declaredType] = row[AppearanceVariationsTable.declaredType]
            it[displayName] = row[AppearanceVariationsTable.displayName]
        }
    }

    /** Меняет позицию значения оси, сохраняя остальные поля. */
    fun moveAxisValue(designSystemId: UUID, row: ResultRow, position: Int) {
        if (row[AppearanceVariationValuesTable.position] == position) return
        AppearanceVariationValueRevisionsTable.replaceRevision(
            AppearanceVariationValueRevisionsTable.entityId,
            row[AppearanceVariationValuesTable.id],
            designSystemId,
            changedPaths = setOf("/position"),
        ) {
            it[styleId] = row[AppearanceVariationValuesTable.styleId]
            it[AppearanceVariationValueRevisionsTable.position] = position
            it[authoredId] = row[AppearanceVariationValuesTable.authoredId]
            it[displayName] = row[AppearanceVariationValuesTable.displayName]
        }
    }

    /** Снимает стиль по умолчанию с оси. */
    fun clearAxisDefault(designSystemId: UUID, row: ResultRow) {
        AppearanceVariationRevisionsTable.replaceRevision(
            AppearanceVariationRevisionsTable.entityId,
            row[AppearanceVariationsTable.id],
            designSystemId,
            changedPaths = setOf("/default_style_id"),
        ) {
            it[position] = row[AppearanceVariationsTable.position]
            it[defaultStyleId] = null
            it[declaredType] = row[AppearanceVariationsTable.declaredType]
            it[displayName] = row[AppearanceVariationsTable.displayName]
        }
    }

    fun removeAxis(designSystemId: UUID, row: ResultRow) {
        AppearanceVariationRevisionsTable.replaceRevision(
            AppearanceVariationRevisionsTable.entityId,
            row[AppearanceVariationsTable.id],
            designSystemId,
            deleted = true,
        ) {
            it[position] = row[AppearanceVariationsTable.position]
            it[defaultStyleId] = row[AppearanceVariationsTable.defaultStyleId]
            it[declaredType] = row[AppearanceVariationsTable.declaredType]
            it[displayName] = row[AppearanceVariationsTable.displayName]
        }
    }

    fun removeAxisValue(designSystemId: UUID, row: ResultRow) {
        AppearanceVariationValueRevisionsTable.replaceRevision(
            AppearanceVariationValueRevisionsTable.entityId,
            row[AppearanceVariationValuesTable.id],
            designSystemId,
            deleted = true,
        ) {
            it[styleId] = row[AppearanceVariationValuesTable.styleId]
            it[position] = row[AppearanceVariationValuesTable.position]
            it[authoredId] = row[AppearanceVariationValuesTable.authoredId]
            it[displayName] = row[AppearanceVariationValuesTable.displayName]
        }
    }

    fun removeInvariantValue(designSystemId: UUID, row: ResultRow) {
        InvariantPropertyValueRevisionsTable.replaceRevision(
            InvariantPropertyValueRevisionsTable.entityId,
            row[InvariantPropertyValuesTable.id],
            designSystemId,
            deleted = true,
        ) {
            it[tokenId] = row[InvariantPropertyValuesTable.tokenId]
            it[value] = row[InvariantPropertyValuesTable.value]
            it[alpha] = row[InvariantPropertyValuesTable.alpha]
            it[adjustment] = row[InvariantPropertyValuesTable.adjustment]
            it[position] = row[InvariantPropertyValuesTable.position]
            it[stateSetId] = row[InvariantPropertyValuesTable.stateSetId]
        }
    }

    fun removeVariationValue(designSystemId: UUID, row: ResultRow) {
        VariationPropertyValueRevisionsTable.replaceRevision(
            VariationPropertyValueRevisionsTable.entityId,
            row[VariationPropertyValuesTable.id],
            designSystemId,
            deleted = true,
        ) {
            it[tokenId] = row[VariationPropertyValuesTable.tokenId]
            it[value] = row[VariationPropertyValuesTable.value]
            it[alpha] = row[VariationPropertyValuesTable.alpha]
            it[adjustment] = row[VariationPropertyValuesTable.adjustment]
            it[position] = row[VariationPropertyValuesTable.position]
            it[stateSetId] = row[VariationPropertyValuesTable.stateSetId]
        }
    }

    fun removeCombination(designSystemId: UUID, row: ResultRow) {
        StyleCombinationRevisionsTable.replaceRevision(
            StyleCombinationRevisionsTable.entityId,
            row[StyleCombinationsTable.id],
            designSystemId,
            deleted = true,
        ) {
            it[combinationKey] = row[StyleCombinationsTable.combinationKey]
            it[value] = row[StyleCombinationsTable.value]
            it[tokenId] = row[StyleCombinationsTable.tokenId]
            it[alpha] = row[StyleCombinationsTable.alpha]
            it[adjustment] = row[StyleCombinationsTable.adjustment]
            it[position] = row[StyleCombinationsTable.position]
            it[stateSetId] = row[StyleCombinationsTable.stateSetId]
        }
    }

    fun removeCombinationMember(designSystemId: UUID, row: ResultRow) {
        StyleCombinationMemberRevisionsTable.replaceRevision(
            StyleCombinationMemberRevisionsTable.entityId,
            row[StyleCombinationMembersTable.id],
            designSystemId,
            deleted = true,
        ) { it[styleId] = row[StyleCombinationMembersTable.styleId] }
    }

    fun removeDeclaredCombination(designSystemId: UUID, row: ResultRow) {
        AppearanceCombinationRevisionsTable.replaceRevision(
            AppearanceCombinationRevisionsTable.entityId,
            row[AppearanceCombinationsTable.id],
            designSystemId,
            deleted = true,
        ) {
            it[combinationKey] = row[AppearanceCombinationsTable.combinationKey]
            it[position] = row[AppearanceCombinationsTable.position]
            it[authoredId] = row[AppearanceCombinationsTable.authoredId]
        }
    }

    fun removeDeclaredCombinationMember(designSystemId: UUID, row: ResultRow) {
        AppearanceCombinationMemberRevisionsTable.replaceRevision(
            AppearanceCombinationMemberRevisionsTable.entityId,
            row[AppearanceCombinationMembersTable.id],
            designSystemId,
            deleted = true,
        ) {
            it[styleId] = row[AppearanceCombinationMembersTable.styleId]
            it[position] = row[AppearanceCombinationMembersTable.position]
        }
    }

    fun removeVariationAdjustment(designSystemId: UUID, row: ResultRow) {
        VariationPlatformParamAdjustmentRevisionsTable.replaceRevision(
            VariationPlatformParamAdjustmentRevisionsTable.entityId,
            row[VariationPlatformParamAdjustmentsTable.id],
            designSystemId,
            deleted = true,
        ) {
            it[value] = row[VariationPlatformParamAdjustmentsTable.value]
            it[template] = row[VariationPlatformParamAdjustmentsTable.template]
        }
    }

    fun removeInvariantAdjustment(designSystemId: UUID, row: ResultRow) {
        InvariantPlatformParamAdjustmentRevisionsTable.replaceRevision(
            InvariantPlatformParamAdjustmentRevisionsTable.entityId,
            row[InvariantPlatformParamAdjustmentsTable.id],
            designSystemId,
            deleted = true,
        ) {
            it[value] = row[InvariantPlatformParamAdjustmentsTable.value]
            it[template] = row[InvariantPlatformParamAdjustmentsTable.template]
        }
    }

    fun removeReuseConfig(designSystemId: UUID, row: ResultRow) {
        ComponentReuseConfigRevisionsTable.replaceRevision(
            ComponentReuseConfigRevisionsTable.entityId,
            row[ComponentReuseConfigsTable.id],
            designSystemId,
            deleted = true,
        ) {
            it[appearanceId] = row[ComponentReuseConfigsTable.appearanceId]
            it[variationId] = row[ComponentReuseConfigsTable.variationId]
            it[styleId] = row[ComponentReuseConfigsTable.styleId]
        }
    }

    fun removeReference(designSystemId: UUID, row: ResultRow) {
        ComponentStyleReferenceRevisionsTable.replaceRevision(
            ComponentStyleReferenceRevisionsTable.entityId,
            row[ComponentStyleReferencesTable.id],
            designSystemId,
            deleted = true,
        ) {
            it[invariantPropertyValueId] = row[ComponentStyleReferencesTable.invariantPropertyValueId]
            it[variationPropertyValueId] = row[ComponentStyleReferencesTable.variationPropertyValueId]
            it[styleCombinationId] = row[ComponentStyleReferencesTable.styleCombinationId]
            it[targetAppearanceId] = row[ComponentStyleReferencesTable.targetAppearanceId]
            it[reference] = row[ComponentStyleReferencesTable.reference]
        }
    }

    fun removeReferenceStyle(designSystemId: UUID, row: ResultRow) {
        ComponentStyleReferenceStyleRevisionsTable.replaceRevision(
            ComponentStyleReferenceStyleRevisionsTable.entityId,
            row[ComponentStyleReferenceStylesTable.id],
            designSystemId,
            deleted = true,
        ) { it[styleId] = row[ComponentStyleReferenceStylesTable.styleId] }
    }
}
