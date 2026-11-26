package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.components.domain.AppearanceEditorModel
import com.dsbuilder.ds.components.domain.EditorAxis
import com.dsbuilder.ds.components.domain.EditorAxisValue
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.components.domain.EditorStyleReference
import com.dsbuilder.ds.components.domain.EditorValueKind
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Собирает модель оформления для редактора из разрешённого состояния черновика или версии. */
internal object AppearanceEditorModelReader {
    fun read(projectId: ProjectId, systemAdmin: Boolean, appearanceId: UUID, versionId: UUID?): AppearanceEditorModel? {
        val row = EditorSupport.readableAppearance(projectId, systemAdmin, appearanceId) ?: return null
        return readMany(listOf(row), versionId).single()
    }

    /** Пакетное чтение оформлений одной ДС в текущем контексте Core/версии, без повторения справочников. */
    fun readMany(rows: List<ResultRow>, versionId: UUID?): List<AppearanceEditorModel> {
        if (rows.isEmpty()) return emptyList()
        val designSystemId = rows.first()[ComponentAppearancesTable.designSystemId]
        require(rows.all { it[ComponentAppearancesTable.designSystemId] == designSystemId })
        val ids = rows.map { it[ComponentAppearancesTable.id] }
        val axes = axesByAppearance(ids, designSystemId, versionId)
        val values = propertyValuesByAppearance(ids, designSystemId, versionId)
        val revisions = EditorSupport.revisions(designSystemId, versionId, "appearance", ids)
        return rows.map { row ->
            val id = row[ComponentAppearancesTable.id]
            AppearanceEditorModel(appearance(row), revisions[id], axes[id].orEmpty(), values[id].orEmpty())
        }
    }

    /** Значения для проверки без редакторских подписей, осей и ревизий, не нужных исправным назначениям. */
    fun readForCompatibility(rows: List<ResultRow>, versionId: UUID?): List<AppearanceEditorModel> {
        if (rows.isEmpty()) return emptyList()
        val designSystemId = rows.first()[ComponentAppearancesTable.designSystemId]
        require(rows.all { it[ComponentAppearancesTable.designSystemId] == designSystemId })
        val values = propertyValuesByAppearance(
            rows.map { it[ComponentAppearancesTable.id] },
            designSystemId,
            versionId,
            withDetails = false,
        )
        return rows.map { row ->
            AppearanceEditorModel(
                appearance(row),
                null,
                emptyList(),
                values[row[ComponentAppearancesTable.id]].orEmpty(),
            )
        }
    }

    /** Пакетно дополняет только проблемные назначения; использует ту же транзакционную границу. */
    fun completeCompatibilityDetails(
        models: List<AppearanceEditorModel>,
        versionId: UUID?,
    ): List<AppearanceEditorModel> {
        if (models.isEmpty()) return emptyList()
        val designSystemId = models.first().appearance.designSystemId
        require(models.all { it.appearance.designSystemId == designSystemId })
        val axes = axesByAppearance(models.map { it.appearance.id }, designSystemId, versionId)
        val values = models.flatMap { it.propertyValues }
        val names = tokenNames(values)
        val kinds = mapOf(
            EditorValueKind.INVARIANT to "invariant-property-value",
            EditorValueKind.VARIATION to "variation-property-value",
            EditorValueKind.COMBINATION to "style-combination",
        )
        val revisions = kinds.mapValues { (kind, entityType) ->
            EditorSupport.revisions(
                designSystemId,
                versionId,
                entityType,
                values.filter { it.kind == kind }.map { it.id },
            )
        }
        return models.map { model ->
            model.copy(
                axes = axes[model.appearance.id].orEmpty(),
                propertyValues = model.propertyValues.map { value ->
                    value.copy(
                        tokenName = value.tokenId?.let(names::get),
                        revision = revisions.getValue(value.kind)[value.id],
                    )
                },
            )
        }
    }

    /** Оси оформления с действующими именами, ролями и значениями. */
    fun axes(appearanceId: UUID, designSystemId: UUID, versionId: UUID?): List<EditorAxis> =
        axesByAppearance(listOf(appearanceId), designSystemId, versionId)[appearanceId].orEmpty()

    private fun axesByAppearance(
        appearanceIds: List<UUID>,
        designSystemId: UUID,
        versionId: UUID?,
    ): Map<UUID, List<EditorAxis>> {
        val rolesByAppearance = AppearanceAxisRoleStore.load(appearanceIds)
        val axisRows = AppearanceVariationsTable.innerJoin(VariationsTable).selectAll()
            .where { AppearanceVariationsTable.appearanceId inList appearanceIds }
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
        return axisRows.groupBy { it[AppearanceVariationsTable.appearanceId] }.mapValues { (appearanceId, rows) ->
            rows.map { axis ->
                val roles = rolesByAppearance[appearanceId]
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
    }

    /** Справочники, нужные для сборки значений: имена свойств и состояний, ссылки и технические редакции. */
    private class ValueLookups(
        val properties: Map<UUID, String>,
        val stateNames: Map<UUID, List<String>>,
        val references: References,
        val revisions: Map<String, Map<UUID, Long>>,
    )

    private fun propertyValuesByAppearance(
        appearanceIds: List<UUID>,
        designSystemId: UUID,
        versionId: UUID?,
        withDetails: Boolean = true,
    ): Map<UUID, List<EditorPropertyValue>> {
        val invariants = InvariantPropertyValuesTable.selectAll()
            .where { InvariantPropertyValuesTable.appearanceId inList appearanceIds }.toList()
        val variations = VariationPropertyValuesTable.selectAll()
            .where { VariationPropertyValuesTable.appearanceId inList appearanceIds }.toList()
        val combinations = StyleCombinationsTable.selectAll()
            .where { StyleCombinationsTable.appearanceId inList appearanceIds }.toList()
        val setIds = invariants.map { it[InvariantPropertyValuesTable.stateSetId] } +
            variations.map { it[VariationPropertyValuesTable.stateSetId] } +
            combinations.map { it[StyleCombinationsTable.stateSetId] }
        fun revisions(type: String, ids: List<UUID>) = if (withDetails) {
            EditorSupport.revisions(designSystemId, versionId, type, ids)
        } else {
            emptyMap()
        }
        val lookups = ValueLookups(
            properties = if (withDetails) {
                DiagnosticPropertiesTable.selectAll()
                    .associate { it[DiagnosticPropertiesTable.id] to it[DiagnosticPropertiesTable.name] }
            } else {
                emptyMap()
            },
            stateNames = if (withDetails) EditorSupport.stateNames(setIds.toSet()) else emptyMap(),
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
        val owners = buildMap {
            invariants.forEach {
                put(
                    EditorValueKind.INVARIANT to it[InvariantPropertyValuesTable.id],
                    it[InvariantPropertyValuesTable.appearanceId],
                )
            }
            variations.forEach {
                put(
                    EditorValueKind.VARIATION to it[VariationPropertyValuesTable.id],
                    it[VariationPropertyValuesTable.appearanceId],
                )
            }
            combinations.forEach {
                put(
                    EditorValueKind.COMBINATION to it[StyleCombinationsTable.id],
                    it[StyleCombinationsTable.appearanceId],
                )
            }
        }
        if (!withDetails) return values.groupBy { owners.getValue(it.kind to it.id) }
        val names = tokenNames(values)
        return values.map { it.copy(tokenName = it.tokenId?.let(names::get)) }.sortedWith(
            compareBy({ it.propertyName }, { it.kind }, { it.styleIds.joinToString() }, { it.position }),
        ).groupBy { owners.getValue(it.kind to it.id) }
    }

    private fun tokenNames(values: List<EditorPropertyValue>): Map<UUID, String?> {
        val tokenIds = values.mapNotNull { it.tokenId }.distinct()
        if (tokenIds.isEmpty()) return emptyMap()
        return ComponentTokensTable.selectAll().where { ComponentTokensTable.id inList tokenIds }
            .associate { row ->
                row[ComponentTokensTable.id] to
                    referenceName(row[ComponentTokensTable.name], row[ComponentTokensTable.type])
            }
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
                members[id].orEmpty().sorted(),
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
        fun byOwner(column: Column<UUID?>) = rows.mapNotNull { row ->
            row[column]?.let { owner -> owner to model(row) }
        }.toMap()
        return References(
            byOwner(ComponentStyleReferencesTable.invariantPropertyValueId),
            byOwner(ComponentStyleReferencesTable.variationPropertyValueId),
            byOwner(ComponentStyleReferencesTable.styleCombinationId),
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
