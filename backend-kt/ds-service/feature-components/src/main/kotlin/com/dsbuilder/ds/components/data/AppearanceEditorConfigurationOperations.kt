package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.AppearanceEditorRepository
import com.dsbuilder.ds.components.data.StyleReferenceWriter.Source
import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.lowerCase
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Операции редактора над конфигурациями компонента: создание новой и дублирование существующей. */
internal object AppearanceEditorConfigurationOperations {
    private const val COLOR_SCHEME_AXIS = "view"
    private const val COLOR_SCHEME_VALUE = "default"

    @Suppress("ReturnCount")
    fun createAppearance(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: AppearanceEditorRepository.NewAppearance,
    ): Appearance? {
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, command.designSystemId)) return null
        if (command.componentId !in ComponentOwnership.writableComponentIds(projectId, systemAdmin)) return null
        val component = ComponentsTable.selectAll()
            .where { ComponentsTable.id eq command.componentId }.singleOrNull() ?: return null
        val designSystemId = command.designSystemId
        val componentId = command.componentId
        val componentName = component[ComponentsTable.name]
        val first = !hasDefault(designSystemId, componentId)
        val name = command.name?.let { AppearanceNaming.requireFree(designSystemId, componentId, it) }
            ?: AppearanceNaming.freeName(
                designSystemId,
                componentId,
                if (first) componentName else "$componentName new",
            )
        val appearanceId = newAppearance(designSystemId, componentId, name, first, null, null)
        addColorSchemeAxis(designSystemId, componentId, appearanceId)
        return AppearanceEditorModelReader.appearance(requireNotNull(appearanceRow(appearanceId)))
    }

    /** У компонента уже есть конфигурация по умолчанию, в том числе без имени. */
    private fun hasDefault(designSystemId: UUID, componentId: UUID): Boolean =
        ComponentAppearancesTable.selectAll().where {
            (ComponentAppearancesTable.designSystemId eq designSystemId) and
                (ComponentAppearancesTable.componentId eq componentId) and
                (ComponentAppearancesTable.isDefault eq true)
        }.any()

    fun duplicateAppearance(
        projectId: ProjectId,
        systemAdmin: Boolean,
        sourceId: UUID,
        name: String?,
    ): Appearance? {
        val source = EditorSupport.writableAppearance(projectId, systemAdmin, sourceId) ?: return null
        val designSystemId = source[ComponentAppearancesTable.designSystemId]
        val componentId = source[ComponentAppearancesTable.componentId]
        val sourceName = source[ComponentAppearancesTable.name] ?: "default"
        val newName = name?.let { AppearanceNaming.requireFree(designSystemId, componentId, it) }
            ?: AppearanceNaming.freeName(designSystemId, componentId, "$sourceName copy")
        val copyId = newAppearance(designSystemId, componentId, newName, false, null, null)
        copyAxes(designSystemId, sourceId, copyId)
        // Роли ссылаются на объявления осей, поэтому записываются после их копирования.
        val root = source[ComponentAppearancesTable.rootVariationId]
        val colorScheme = source[ComponentAppearancesTable.colorSchemeVariationId]
        if (root != null || colorScheme != null) AppearanceAxisRoleStore.store(copyId, root, colorScheme)
        copyDeclaredCombinations(designSystemId, sourceId, copyId)
        copyInvariantValues(designSystemId, componentId, sourceId, copyId)
        copyVariationValues(designSystemId, sourceId, copyId)
        copyCombinations(designSystemId, sourceId, copyId)
        copyReuseConfigs(designSystemId, sourceId, copyId)
        return AppearanceEditorModelReader.appearance(requireNotNull(appearanceRow(copyId)))
    }

    private fun newAppearance(
        designSystemId: UUID,
        componentId: UUID,
        name: String,
        isDefault: Boolean,
        root: UUID?,
        colorScheme: UUID?,
    ): UUID {
        val id = StableAppearancesTable.insertReturning {
            it[StableAppearancesTable.designSystemId] = designSystemId
            it[StableAppearancesTable.componentId] = componentId
        }.single()[StableAppearancesTable.id]
        AppearanceRevisionsTable.replaceRevision(AppearanceRevisionsTable.entityId, id, designSystemId) {
            it[AppearanceRevisionsTable.name] = name
            it[rootVariationId] = root
            it[colorSchemeVariationId] = colorScheme
            it[AppearanceRevisionsTable.isDefault] = isDefault
        }
        return id
    }

    /** Добавляет ось цветовой схемы `view` со значением `default`, переиспользуя вариацию и стиль каталога. */
    private fun addColorSchemeAxis(designSystemId: UUID, componentId: UUID, appearanceId: UUID) {
        val variationId = VariationsTable.selectAll().where {
            (VariationsTable.componentId eq componentId) and (VariationsTable.name.lowerCase() eq COLOR_SCHEME_AXIS)
        }.singleOrNull()?.get(VariationsTable.id) ?: VariationsTable.insertReturning {
            it[VariationsTable.componentId] = componentId
            it[name] = COLOR_SCHEME_AXIS
            it[description] = null
        }.single()[VariationsTable.id]
        val styleId = ComponentStylesTable.selectAll().where {
            (ComponentStylesTable.designSystemId eq designSystemId) and
                (ComponentStylesTable.variationId eq variationId) and
                (ComponentStylesTable.name eq COLOR_SCHEME_VALUE)
        }.singleOrNull()?.get(ComponentStylesTable.id)
            ?: EditorWrites.newStyle(designSystemId, variationId, COLOR_SCHEME_VALUE)
        val axisId = EditorWrites.newAxis(designSystemId, appearanceId, variationId, 0, styleId, null, null)
        EditorWrites.newAxisValue(designSystemId, axisId, styleId, 0, null, null)
        AppearanceAxisRoleStore.apply(appearanceId, variationId, root = null, colorScheme = true)
        AppearanceAxisRoleStore.ensureRoot(appearanceId)
    }

    private fun copyAxes(designSystemId: UUID, sourceId: UUID, copyId: UUID) {
        val axes = AppearanceVariationsTable.selectAll().where { AppearanceVariationsTable.appearanceId eq sourceId }
            .orderBy(AppearanceVariationsTable.position).toList()
        axes.forEach { axis ->
            val newAxis = EditorWrites.newAxis(
                designSystemId,
                copyId,
                axis[AppearanceVariationsTable.variationId],
                axis[AppearanceVariationsTable.position],
                axis[AppearanceVariationsTable.defaultStyleId],
                axis[AppearanceVariationsTable.declaredType],
                axis[AppearanceVariationsTable.displayName],
            )
            AppearanceVariationValuesTable.selectAll()
                .where { AppearanceVariationValuesTable.appearanceVariationId eq axis[AppearanceVariationsTable.id] }
                .orderBy(AppearanceVariationValuesTable.position).forEach { value ->
                    EditorWrites.newAxisValue(
                        designSystemId,
                        newAxis,
                        value[AppearanceVariationValuesTable.styleId],
                        value[AppearanceVariationValuesTable.position],
                        value[AppearanceVariationValuesTable.authoredId],
                        value[AppearanceVariationValuesTable.displayName],
                    )
                }
        }
    }

    private fun copyDeclaredCombinations(designSystemId: UUID, sourceId: UUID, copyId: UUID) {
        val combinations = AppearanceCombinationsTable.selectAll()
            .where { AppearanceCombinationsTable.appearanceId eq sourceId }.toList()
        combinations.forEach { combination ->
            val id = StableAppearanceCombinationsTable.insertReturning {
                it[appearanceId] = copyId
                it[StableAppearanceCombinationsTable.designSystemId] = designSystemId
            }.single()[StableAppearanceCombinationsTable.id]
            AppearanceCombinationRevisionsTable.replaceRevision(
                AppearanceCombinationRevisionsTable.entityId,
                id,
                designSystemId,
            ) {
                it[combinationKey] = combination[AppearanceCombinationsTable.combinationKey]
                it[position] = combination[AppearanceCombinationsTable.position]
                it[authoredId] = combination[AppearanceCombinationsTable.authoredId]
            }
            val members = AppearanceCombinationMembersTable.selectAll().where {
                AppearanceCombinationMembersTable.appearanceCombinationId eq combination[AppearanceCombinationsTable.id]
            }.toList()
            members.forEach { member ->
                val memberId = StableAppearanceCombinationMembersTable.insertReturning {
                    it[appearanceCombinationId] = id
                    it[StableAppearanceCombinationMembersTable.designSystemId] = designSystemId
                }.single()[StableAppearanceCombinationMembersTable.id]
                AppearanceCombinationMemberRevisionsTable.replaceRevision(
                    AppearanceCombinationMemberRevisionsTable.entityId,
                    memberId,
                    designSystemId,
                ) {
                    it[styleId] = member[AppearanceCombinationMembersTable.styleId]
                    it[position] = member[AppearanceCombinationMembersTable.position]
                }
            }
        }
    }

    private fun copyInvariantValues(designSystemId: UUID, componentId: UUID, sourceId: UUID, copyId: UUID) {
        val rows = InvariantPropertyValuesTable.selectAll()
            .where { InvariantPropertyValuesTable.appearanceId eq sourceId }.toList()
        rows.forEach { row ->
            val id = StableInvariantPropertyValuesTable.insertReturning {
                it[propertyId] = row[InvariantPropertyValuesTable.propertyId]
                it[StableInvariantPropertyValuesTable.designSystemId] = designSystemId
                it[StableInvariantPropertyValuesTable.componentId] = componentId
                it[appearanceId] = copyId
            }.single()[StableInvariantPropertyValuesTable.id]
            InvariantPropertyValueRevisionsTable.replaceRevision(
                InvariantPropertyValueRevisionsTable.entityId,
                id,
                designSystemId,
            ) {
                it[tokenId] = row[InvariantPropertyValuesTable.tokenId]
                it[value] = row[InvariantPropertyValuesTable.value]
                it[alpha] = row[InvariantPropertyValuesTable.alpha]
                it[adjustment] = row[InvariantPropertyValuesTable.adjustment]
                it[position] = row[InvariantPropertyValuesTable.position]
                it[stateSetId] = row[InvariantPropertyValuesTable.stateSetId]
            }
            val adjustments = InvariantPlatformParamAdjustmentsTable.selectAll()
                .where { InvariantPlatformParamAdjustmentsTable.ipvId eq row[InvariantPropertyValuesTable.id] }.toList()
            adjustments.forEach { adjustment ->
                val adjustmentId = StableInvariantPlatformParamAdjustmentsTable.insertReturning {
                    it[ipvId] = id
                    it[platformParamId] = adjustment[InvariantPlatformParamAdjustmentsTable.platformParamId]
                    it[StableInvariantPlatformParamAdjustmentsTable.designSystemId] = designSystemId
                }.single()[StableInvariantPlatformParamAdjustmentsTable.id]
                InvariantPlatformParamAdjustmentRevisionsTable.replaceRevision(
                    InvariantPlatformParamAdjustmentRevisionsTable.entityId,
                    adjustmentId,
                    designSystemId,
                ) {
                    it[value] = adjustment[InvariantPlatformParamAdjustmentsTable.value]
                    it[template] = adjustment[InvariantPlatformParamAdjustmentsTable.template]
                }
            }
            copyReference(designSystemId, Source.Invariant(row[InvariantPropertyValuesTable.id]), Source.Invariant(id))
        }
    }

    private fun copyVariationValues(designSystemId: UUID, sourceId: UUID, copyId: UUID) {
        val rows = VariationPropertyValuesTable.selectAll()
            .where { VariationPropertyValuesTable.appearanceId eq sourceId }.toList()
        rows.forEach { row ->
            val id = StableVariationPropertyValuesTable.insertReturning {
                it[propertyId] = row[VariationPropertyValuesTable.propertyId]
                it[styleId] = row[VariationPropertyValuesTable.styleId]
                it[appearanceId] = copyId
                it[StableVariationPropertyValuesTable.designSystemId] = designSystemId
            }.single()[StableVariationPropertyValuesTable.id]
            VariationPropertyValueRevisionsTable.replaceRevision(
                VariationPropertyValueRevisionsTable.entityId,
                id,
                designSystemId,
            ) {
                it[tokenId] = row[VariationPropertyValuesTable.tokenId]
                it[value] = row[VariationPropertyValuesTable.value]
                it[alpha] = row[VariationPropertyValuesTable.alpha]
                it[adjustment] = row[VariationPropertyValuesTable.adjustment]
                it[position] = row[VariationPropertyValuesTable.position]
                it[stateSetId] = row[VariationPropertyValuesTable.stateSetId]
            }
            val adjustments = VariationPlatformParamAdjustmentsTable.selectAll()
                .where { VariationPlatformParamAdjustmentsTable.vpvId eq row[VariationPropertyValuesTable.id] }.toList()
            adjustments.forEach { adjustment ->
                val adjustmentId = StableVariationPlatformParamAdjustmentsTable.insertReturning {
                    it[vpvId] = id
                    it[platformParamId] = adjustment[VariationPlatformParamAdjustmentsTable.platformParamId]
                    it[StableVariationPlatformParamAdjustmentsTable.designSystemId] = designSystemId
                }.single()[StableVariationPlatformParamAdjustmentsTable.id]
                VariationPlatformParamAdjustmentRevisionsTable.replaceRevision(
                    VariationPlatformParamAdjustmentRevisionsTable.entityId,
                    adjustmentId,
                    designSystemId,
                ) {
                    it[value] = adjustment[VariationPlatformParamAdjustmentsTable.value]
                    it[template] = adjustment[VariationPlatformParamAdjustmentsTable.template]
                }
            }
            copyReference(designSystemId, Source.Variation(row[VariationPropertyValuesTable.id]), Source.Variation(id))
        }
    }

    private fun copyCombinations(designSystemId: UUID, sourceId: UUID, copyId: UUID) {
        val rows = StyleCombinationsTable.selectAll().where { StyleCombinationsTable.appearanceId eq sourceId }.toList()
        rows.forEach { row ->
            val id = StableStyleCombinationsTable.insertReturning {
                it[propertyId] = row[StyleCombinationsTable.propertyId]
                it[appearanceId] = copyId
                it[StableStyleCombinationsTable.designSystemId] = designSystemId
            }.single()[StableStyleCombinationsTable.id]
            StyleCombinationRevisionsTable.replaceRevision(
                StyleCombinationRevisionsTable.entityId,
                id,
                designSystemId,
            ) {
                it[combinationKey] = row[StyleCombinationsTable.combinationKey]
                it[value] = row[StyleCombinationsTable.value]
                it[tokenId] = row[StyleCombinationsTable.tokenId]
                it[alpha] = row[StyleCombinationsTable.alpha]
                it[adjustment] = row[StyleCombinationsTable.adjustment]
                it[position] = row[StyleCombinationsTable.position]
                it[stateSetId] = row[StyleCombinationsTable.stateSetId]
            }
            val members = StyleCombinationMembersTable.selectAll()
                .where { StyleCombinationMembersTable.combinationId eq row[StyleCombinationsTable.id] }.toList()
            members.forEach { member ->
                val memberId = StableStyleCombinationMembersTable.insertReturning {
                    it[combinationId] = id
                    it[StableStyleCombinationMembersTable.designSystemId] = designSystemId
                }.single()[StableStyleCombinationMembersTable.id]
                StyleCombinationMemberRevisionsTable.replaceRevision(
                    StyleCombinationMemberRevisionsTable.entityId,
                    memberId,
                    designSystemId,
                ) { it[styleId] = member[StyleCombinationMembersTable.styleId] }
            }
            copyReference(designSystemId, Source.Combination(row[StyleCombinationsTable.id]), Source.Combination(id))
        }
    }

    private fun copyReference(designSystemId: UUID, from: Source, to: Source) {
        val reference = StyleReferenceWriter.existing(from) ?: return
        val referenceId = StableComponentStyleReferencesTable.insertReturning {
            it[StableComponentStyleReferencesTable.designSystemId] = designSystemId
        }.single()[StableComponentStyleReferencesTable.id]
        ComponentStyleReferenceRevisionsTable.replaceRevision(
            ComponentStyleReferenceRevisionsTable.entityId,
            referenceId,
            designSystemId,
        ) {
            it[invariantPropertyValueId] = (to as? Source.Invariant)?.id
            it[variationPropertyValueId] = (to as? Source.Variation)?.id
            it[styleCombinationId] = (to as? Source.Combination)?.id
            it[targetAppearanceId] = reference[ComponentStyleReferencesTable.targetAppearanceId]
            it[ComponentStyleReferenceRevisionsTable.reference] = reference[ComponentStyleReferencesTable.reference]
        }
        val styles = ComponentStyleReferenceStylesTable.selectAll()
            .where { ComponentStyleReferenceStylesTable.referenceId eq reference[ComponentStyleReferencesTable.id] }
            .toList()
        styles.forEach { style ->
            val id = StableComponentStyleReferenceStylesTable.insertReturning {
                it[StableComponentStyleReferenceStylesTable.referenceId] = referenceId
                it[StableComponentStyleReferenceStylesTable.designSystemId] = designSystemId
            }.single()[StableComponentStyleReferenceStylesTable.id]
            ComponentStyleReferenceStyleRevisionsTable.replaceRevision(
                ComponentStyleReferenceStyleRevisionsTable.entityId,
                id,
                designSystemId,
            ) { it[styleId] = style[ComponentStyleReferenceStylesTable.styleId] }
        }
    }

    private fun copyReuseConfigs(designSystemId: UUID, sourceId: UUID, copyId: UUID) {
        val rows = ComponentReuseConfigsTable.selectAll().where { ComponentReuseConfigsTable.appearanceId eq sourceId }
            .toList()
        rows.forEach { row ->
            val id = StableComponentReuseConfigsTable.insertReturning {
                it[componentDepId] = row[ComponentReuseConfigsTable.componentDepId]
                it[StableComponentReuseConfigsTable.designSystemId] = designSystemId
            }.single()[StableComponentReuseConfigsTable.id]
            ComponentReuseConfigRevisionsTable.replaceRevision(
                ComponentReuseConfigRevisionsTable.entityId,
                id,
                designSystemId,
            ) {
                it[appearanceId] = copyId
                it[variationId] = row[ComponentReuseConfigsTable.variationId]
                it[styleId] = row[ComponentReuseConfigsTable.styleId]
            }
        }
    }
}
