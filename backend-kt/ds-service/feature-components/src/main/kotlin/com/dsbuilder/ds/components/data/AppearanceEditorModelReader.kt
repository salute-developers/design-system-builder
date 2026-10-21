package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.components.domain.AppearanceEditorModel
import com.dsbuilder.ds.components.domain.EditorAxis
import com.dsbuilder.ds.components.domain.EditorAxisValue
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.components.domain.EditorStyleReference
import com.dsbuilder.ds.components.domain.EditorValueKind
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Собирает модель оформления для редактора из разрешённого состояния черновика или версии. */
internal object AppearanceEditorModelReader {
    fun read(projectId: ProjectId, systemAdmin: Boolean, appearanceId: UUID, versionId: UUID?): AppearanceEditorModel? {
        val row = EditorSupport.readableAppearance(projectId, systemAdmin, appearanceId) ?: return null
        val designSystemId = row[ComponentAppearancesTable.designSystemId]
        val axes = axes(appearanceId, designSystemId, versionId)
        val values = propertyValues(row, appearanceId, designSystemId, versionId)
        val appearanceRevision = EditorSupport.revisions(designSystemId, versionId, "appearance", listOf(appearanceId))
        return AppearanceEditorModel(
            appearance = appearance(row),
            revision = appearanceRevision[appearanceId],
            axes = axes,
            propertyValues = values,
        )
    }

    /** Оси оформления с действующими именами, ролями и значениями. */
    fun axes(appearanceId: UUID, designSystemId: UUID, versionId: UUID?): List<EditorAxis> {
        val roles = AppearanceAxisRoleStore.load(listOf(appearanceId))[appearanceId]
        val axisRows = AppearanceVariationsTable.innerJoin(VariationsTable).selectAll()
            .where { AppearanceVariationsTable.appearanceId eq appearanceId }
            .orderBy(AppearanceVariationsTable.position).toList()
        val axisIds = axisRows.map { it[AppearanceVariationsTable.id] }
        val valueRows = if (axisIds.isEmpty()) {
            emptyList()
        } else {
            AppearanceVariationValuesTable.innerJoin(ComponentStylesTable).selectAll()
                .where { AppearanceVariationValuesTable.appearanceVariationId inList axisIds }
                .orderBy(AppearanceVariationValuesTable.position).toList()
        }
        val axisRevisions = EditorSupport.revisions(designSystemId, versionId, "appearance-variation", axisIds)
        val valueRevisions = EditorSupport.revisions(
            designSystemId,
            versionId,
            "appearance-variation-value",
            valueRows.map { it[AppearanceVariationValuesTable.id] },
        )
        val valuesByAxis = valueRows.groupBy { it[AppearanceVariationValuesTable.appearanceVariationId] }
        return axisRows.map { axis ->
            val variationId = axis[AppearanceVariationsTable.variationId]
            val isScheme = roles?.colorScheme == variationId
            EditorAxis(
                id = axis[AppearanceVariationsTable.id],
                variationId = variationId,
                name = AppearanceEditorRules.axisName(
                    axis[AppearanceVariationsTable.displayName],
                    axis[VariationsTable.name],
                ),
                displayName = axis[AppearanceVariationsTable.displayName],
                position = axis[AppearanceVariationsTable.position],
                isRoot = roles?.root == variationId,
                isColorScheme = isScheme,
                locked = isScheme,
                defaultStyleId = axis[AppearanceVariationsTable.defaultStyleId],
                declaredType = axis[AppearanceVariationsTable.declaredType],
                revision = axisRevisions[axis[AppearanceVariationsTable.id]],
                values = valuesByAxis[axis[AppearanceVariationsTable.id]].orEmpty().map { value ->
                    EditorAxisValue(
                        id = value[AppearanceVariationValuesTable.id],
                        styleId = value[AppearanceVariationValuesTable.styleId],
                        name = AppearanceEditorRules.axisName(
                            value[AppearanceVariationValuesTable.displayName],
                            value[ComponentStylesTable.name],
                        ),
                        displayName = value[AppearanceVariationValuesTable.displayName],
                        position = value[AppearanceVariationValuesTable.position],
                        authoredId = value[AppearanceVariationValuesTable.authoredId],
                        revision = valueRevisions[value[AppearanceVariationValuesTable.id]],
                    )
                },
            )
        }
    }

    /** Справочники, нужные для сборки значений: имена свойств и состояний, ссылки и технические редакции. */
    private class ValueLookups(
        val properties: Map<UUID, String>,
        val stateNames: Map<UUID, List<String>>,
        val references: References,
        val revisions: Map<String, Map<UUID, Long>>,
    )

    private fun propertyValues(
        appearance: ResultRow,
        appearanceId: UUID,
        designSystemId: UUID,
        versionId: UUID?,
    ): List<EditorPropertyValue> {
        val invariants = InvariantPropertyValuesTable.selectAll()
            .where { InvariantPropertyValuesTable.appearanceId eq appearanceId }.toList()
        val variations = VariationPropertyValuesTable.selectAll()
            .where { VariationPropertyValuesTable.appearanceId eq appearanceId }.toList()
        val combinations = StyleCombinationsTable.selectAll()
            .where { StyleCombinationsTable.appearanceId eq appearanceId }.toList()
        val setIds = invariants.map { it[InvariantPropertyValuesTable.stateSetId] } +
            variations.map { it[VariationPropertyValuesTable.stateSetId] } +
            combinations.map { it[StyleCombinationsTable.stateSetId] }
        fun revisions(type: String, ids: List<UUID>) = EditorSupport.revisions(designSystemId, versionId, type, ids)
        val lookups = ValueLookups(
            properties = PropertiesTable.selectAll()
                .where { PropertiesTable.componentId eq appearance[ComponentAppearancesTable.componentId] }
                .associate { it[PropertiesTable.id] to it[PropertiesTable.name] },
            stateNames = EditorSupport.stateNames(setIds.toSet()),
            references = references(designSystemId),
            revisions = mapOf(
                "invariant" to revisions(
                    "invariant-property-value",
                    invariants.map { it[InvariantPropertyValuesTable.id] },
                ),
                "variation" to revisions(
                    "variation-property-value",
                    variations.map { it[VariationPropertyValuesTable.id] },
                ),
                "combination" to revisions("style-combination", combinations.map { it[StyleCombinationsTable.id] }),
            ),
        )
        val values = invariantValues(invariants, lookups) + variationValues(variations, lookups) +
            combinationValues(combinations, lookups)
        val tokenIds = values.mapNotNull { it.tokenId }.distinct()
        val tokenNames = if (tokenIds.isEmpty()) {
            emptyMap()
        } else {
            ComponentTokensTable.selectAll().where { ComponentTokensTable.id inList tokenIds }
                .associate { it[ComponentTokensTable.id] to it[ComponentTokensTable.name] }
        }
        return values.map { it.copy(tokenName = it.tokenId?.let(tokenNames::get)) }.sortedWith(
            compareBy({ it.propertyName }, { it.kind }, { it.styleIds.joinToString() }, { it.position }),
        )
    }

    private fun invariantValues(rows: List<ResultRow>, lookups: ValueLookups) = rows.map {
        val id = it[InvariantPropertyValuesTable.id]
        val setId = it[InvariantPropertyValuesTable.stateSetId]
        EditorPropertyValue(
            id, EditorValueKind.INVARIANT, it[InvariantPropertyValuesTable.propertyId],
            lookups.properties[it[InvariantPropertyValuesTable.propertyId]].orEmpty(), emptyList(),
            lookups.stateNames[setId].orEmpty(), setId, it[InvariantPropertyValuesTable.tokenId],
            it[InvariantPropertyValuesTable.value], it[InvariantPropertyValuesTable.alpha],
            it[InvariantPropertyValuesTable.adjustment], it[InvariantPropertyValuesTable.position],
            lookups.references.invariant[id], lookups.revisions.getValue("invariant")[id],
        )
    }

    private fun variationValues(rows: List<ResultRow>, lookups: ValueLookups) = rows.map {
        val id = it[VariationPropertyValuesTable.id]
        val setId = it[VariationPropertyValuesTable.stateSetId]
        EditorPropertyValue(
            id, EditorValueKind.VARIATION, it[VariationPropertyValuesTable.propertyId],
            lookups.properties[it[VariationPropertyValuesTable.propertyId]].orEmpty(),
            listOf(it[VariationPropertyValuesTable.styleId]),
            lookups.stateNames[setId].orEmpty(), setId, it[VariationPropertyValuesTable.tokenId],
            it[VariationPropertyValuesTable.value], it[VariationPropertyValuesTable.alpha],
            it[VariationPropertyValuesTable.adjustment], it[VariationPropertyValuesTable.position],
            lookups.references.variation[id], lookups.revisions.getValue("variation")[id],
        )
    }

    private fun combinationValues(rows: List<ResultRow>, lookups: ValueLookups): List<EditorPropertyValue> {
        val members = StyleCombinationMembersTable.selectAll()
            .where { StyleCombinationMembersTable.combinationId inList rows.map { it[StyleCombinationsTable.id] } }
            .groupBy({ it[StyleCombinationMembersTable.combinationId] }, { it[StyleCombinationMembersTable.styleId] })
        return rows.map {
            val id = it[StyleCombinationsTable.id]
            val setId = it[StyleCombinationsTable.stateSetId]
            val token = it[StyleCombinationsTable.tokenId]
            EditorPropertyValue(
                id, EditorValueKind.COMBINATION, it[StyleCombinationsTable.propertyId],
                lookups.properties[it[StyleCombinationsTable.propertyId]].orEmpty(),
                members[id].orEmpty().sortedBy(UUID::toString),
                lookups.stateNames[setId].orEmpty(), setId, token,
                it[StyleCombinationsTable.value].takeIf { token == null },
                it[StyleCombinationsTable.alpha], it[StyleCombinationsTable.adjustment],
                it[StyleCombinationsTable.position], lookups.references.combination[id],
                lookups.revisions.getValue("combination")[id],
            )
        }
    }

    /** Ссылки значений на стили вложенных компонентов по виду владельца. */
    private class References(
        val invariant: Map<UUID, EditorStyleReference>,
        val variation: Map<UUID, EditorStyleReference>,
        val combination: Map<UUID, EditorStyleReference>,
    )

    private fun references(designSystemId: UUID): References {
        val rows = ComponentStyleReferencesTable.selectAll()
            .where { ComponentStyleReferencesTable.designSystemId eq designSystemId }.toList()
        val referenceIds = rows.map { it[ComponentStyleReferencesTable.id] }
        val styles: Map<UUID, List<UUID>> = if (referenceIds.isEmpty()) {
            emptyMap()
        } else {
            ComponentStyleReferenceStylesTable.selectAll()
                .where { ComponentStyleReferenceStylesTable.referenceId inList referenceIds }
                .groupBy(
                    { it[ComponentStyleReferenceStylesTable.referenceId] },
                    { it[ComponentStyleReferenceStylesTable.styleId] },
                )
        }
        fun model(row: ResultRow) = EditorStyleReference(
            row[ComponentStyleReferencesTable.id],
            row[ComponentStyleReferencesTable.targetAppearanceId],
            styles[row[ComponentStyleReferencesTable.id]].orEmpty(),
            row[ComponentStyleReferencesTable.reference],
        )
        return References(
            rows.filter { it[ComponentStyleReferencesTable.invariantPropertyValueId] != null }
                .associate { it[ComponentStyleReferencesTable.invariantPropertyValueId]!! to model(it) },
            rows.filter { it[ComponentStyleReferencesTable.variationPropertyValueId] != null }
                .associate { it[ComponentStyleReferencesTable.variationPropertyValueId]!! to model(it) },
            rows.filter { it[ComponentStyleReferencesTable.styleCombinationId] != null }
                .associate { it[ComponentStyleReferencesTable.styleCombinationId]!! to model(it) },
        )
    }

    fun appearance(row: ResultRow) = Appearance(
        row[ComponentAppearancesTable.id],
        row[ComponentAppearancesTable.designSystemId],
        row[ComponentAppearancesTable.componentId],
        row[ComponentAppearancesTable.name],
        row[ComponentAppearancesTable.isDefault],
        row[ComponentAppearancesTable.createdAt],
        row[ComponentAppearancesTable.updatedAt],
    )
}
