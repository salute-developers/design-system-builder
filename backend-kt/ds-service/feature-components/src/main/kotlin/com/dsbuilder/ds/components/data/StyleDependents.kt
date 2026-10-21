package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.core.data.lockDraftSubjects
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/**
 * Данные оформления, зависящие от набора стилей: значения свойств, сочетания, объявленные координаты и ссылки.
 *
 * Используется при удалении оси или значения оси: собирает зависимые строки, блокирует их в устойчивом порядке
 * и удаляет tombstone-редакциями в черновике. Ссылки других оформлений на удаляемые стили удаляются вместе со
 * значениями-владельцами только при подтверждённом каскаде, иначе операция отклоняется кодом `reference_in_use`.
 */
internal class StyleDependents private constructor(
    private val designSystemId: UUID,
    private val own: Own,
    private val incoming: Incoming,
) {
    /** Строки самого оформления, зависящие от удаляемых стилей. */
    class Own(
        val variationValues: List<ResultRow>,
        val combinations: List<ResultRow>,
        val combinationMembers: List<ResultRow>,
        val declaredCombinations: List<ResultRow>,
        val declaredMembers: List<ResultRow>,
        val variationAdjustments: List<ResultRow>,
        val reuseConfigs: List<ResultRow>,
    )

    /** Значения других оформлений, которые ссылались на удаляемые стили, вместе со ссылками. */
    class Incoming(
        val references: List<ResultRow>,
        val referenceStyles: List<ResultRow>,
        val invariantValues: List<ResultRow>,
        val invariantAdjustments: List<ResultRow>,
        val variationValues: List<ResultRow>,
        val variationAdjustments: List<ResultRow>,
        val combinations: List<ResultRow>,
        val combinationMembers: List<ResultRow>,
    )

    private val variationValues get() = own.variationValues + incoming.variationValues
    private val combinations get() = own.combinations + incoming.combinations
    private val combinationMembers get() = own.combinationMembers + incoming.combinationMembers
    private val variationAdjustments get() = own.variationAdjustments + incoming.variationAdjustments

    /** Число удаляемых значений свойств и сочетаний, включая значения других оформлений со ссылками. */
    val count: Int get() = variationValues.size + combinations.size + incoming.invariantValues.size

    /** Блокирует зависимые сущности: типы в алфавитном порядке, идентификаторы по возрастанию. */
    fun lock() {
        val byType = sortedMapOf(
            "appearance-combination" to ids(own.declaredCombinations, AppearanceCombinationsTable.id),
            "appearance-combination-member" to ids(own.declaredMembers, AppearanceCombinationMembersTable.id),
            "component-reuse-config" to ids(own.reuseConfigs, ComponentReuseConfigsTable.id),
            "component-style-reference" to ids(incoming.references, ComponentStyleReferencesTable.id),
            "component-style-reference-style" to ids(incoming.referenceStyles, ComponentStyleReferenceStylesTable.id),
            "invariant-platform-param-adjustment" to
                ids(incoming.invariantAdjustments, InvariantPlatformParamAdjustmentsTable.id),
            "invariant-property-value" to ids(incoming.invariantValues, InvariantPropertyValuesTable.id),
            "style-combination" to ids(combinations, StyleCombinationsTable.id),
            "style-combination-member" to ids(combinationMembers, StyleCombinationMembersTable.id),
            "variation-platform-param-adjustment" to
                ids(variationAdjustments, VariationPlatformParamAdjustmentsTable.id),
            "variation-property-value" to ids(variationValues, VariationPropertyValuesTable.id),
        )
        byType.forEach { (type, ids) ->
            check(lockDraftSubjects(designSystemId, type, ids)) { "Subject $type is missing" }
        }
    }

    /** Удаляет зависимые строки tombstone-редакциями. */
    fun remove() {
        incoming.referenceStyles.forEach { EditorWrites.removeReferenceStyle(designSystemId, it) }
        incoming.references.forEach { EditorWrites.removeReference(designSystemId, it) }
        variationAdjustments.forEach { EditorWrites.removeVariationAdjustment(designSystemId, it) }
        incoming.invariantAdjustments.forEach { EditorWrites.removeInvariantAdjustment(designSystemId, it) }
        combinationMembers.forEach { EditorWrites.removeCombinationMember(designSystemId, it) }
        variationValues.forEach { EditorWrites.removeVariationValue(designSystemId, it) }
        combinations.forEach { EditorWrites.removeCombination(designSystemId, it) }
        incoming.invariantValues.forEach { EditorWrites.removeInvariantValue(designSystemId, it) }
        own.reuseConfigs.forEach { EditorWrites.removeReuseConfig(designSystemId, it) }
        own.declaredMembers.forEach { EditorWrites.removeDeclaredCombinationMember(designSystemId, it) }
        own.declaredCombinations.forEach { EditorWrites.removeDeclaredCombination(designSystemId, it) }
    }

    private fun ids(rows: List<ResultRow>, column: Column<UUID>): List<UUID> = rows.map { it[column] }

    companion object {
        /** Собирает зависимые строки стилей [styleIds] в оформлении [appearanceId]. */
        fun collect(
            designSystemId: UUID,
            appearanceId: UUID,
            styleIds: Collection<UUID>,
            confirmCascade: Boolean,
            canWriteAppearance: (UUID) -> Boolean = { true },
        ): StyleDependents {
            val styles = styleIds.toList()
            val own = collectOwn(appearanceId, styles)
            val ownReferences = references(own.variationValues, own.combinations)
            val ownReferenceIds = ownReferences.map { it[ComponentStyleReferencesTable.id] }.toSet()
            val incoming = incomingReferences(appearanceId, styles)
                .filter { it[ComponentStyleReferencesTable.id] !in ownReferenceIds }
            if (incoming.isNotEmpty() && !confirmCascade) {
                throw EditorRuleViolationException(
                    "reference_in_use",
                    "${incoming.size} reference(s) from other configurations point to the removed values",
                    conflict = true,
                )
            }
            val owners = incomingOwners(ownReferences, incoming)
            // Каскад меняет значения других оформлений, поэтому право записи нужно и на каждое из них.
            val ownerAppearances = owners.invariantValues.map { it[InvariantPropertyValuesTable.appearanceId] } +
                owners.variationValues.map { it[VariationPropertyValuesTable.appearanceId] } +
                owners.combinations.map { it[StyleCombinationsTable.appearanceId] }
            if (incoming.isNotEmpty() && !ownerAppearances.distinct().all(canWriteAppearance)) {
                throw EditorRuleViolationException(
                    "reference_in_use",
                    "References from configurations that cannot be changed point to the removed values",
                    conflict = true,
                )
            }
            return StyleDependents(designSystemId, own, owners)
        }

        private fun collectOwn(appearanceId: UUID, styles: List<UUID>): Own {
            val variationValues = VariationPropertyValuesTable.rowsOf(styles) {
                (VariationPropertyValuesTable.appearanceId eq appearanceId) and
                    (VariationPropertyValuesTable.styleId inList styles)
            }
            val comboIdsOfStyles = StyleCombinationMembersTable.rowsOf(styles) {
                StyleCombinationMembersTable.styleId inList styles
            }.map { it[StyleCombinationMembersTable.combinationId] }.distinct()
            val combinations = StyleCombinationsTable.rowsOf(comboIdsOfStyles) {
                (StyleCombinationsTable.appearanceId eq appearanceId) and
                    (StyleCombinationsTable.id inList comboIdsOfStyles)
            }
            val declaredIdsOfStyles = AppearanceCombinationMembersTable.rowsOf(styles) {
                AppearanceCombinationMembersTable.styleId inList styles
            }.map { it[AppearanceCombinationMembersTable.appearanceCombinationId] }.distinct()
            val declared = AppearanceCombinationsTable.rowsOf(declaredIdsOfStyles) {
                (AppearanceCombinationsTable.appearanceId eq appearanceId) and
                    (AppearanceCombinationsTable.id inList declaredIdsOfStyles)
            }
            return Own(
                variationValues = variationValues,
                combinations = combinations,
                combinationMembers = StyleCombinationMembersTable.rowsIn(
                    StyleCombinationMembersTable.combinationId,
                    combinations.map { it[StyleCombinationsTable.id] },
                ),
                declaredCombinations = declared,
                declaredMembers = AppearanceCombinationMembersTable.rowsIn(
                    AppearanceCombinationMembersTable.appearanceCombinationId,
                    declared.map { it[AppearanceCombinationsTable.id] },
                ),
                variationAdjustments = VariationPlatformParamAdjustmentsTable.rowsIn(
                    VariationPlatformParamAdjustmentsTable.vpvId,
                    variationValues.map { it[VariationPropertyValuesTable.id] },
                ),
                reuseConfigs = ComponentReuseConfigsTable.rowsOf(styles) {
                    (ComponentReuseConfigsTable.appearanceId eq appearanceId) and
                        (ComponentReuseConfigsTable.styleId inList styles)
                },
            )
        }

        private fun references(variationValues: List<ResultRow>, combinations: List<ResultRow>): List<ResultRow> {
            val variationIds = variationValues.map { it[VariationPropertyValuesTable.id] }
            val comboIds = combinations.map { it[StyleCombinationsTable.id] }
            if (variationIds.isEmpty() && comboIds.isEmpty()) return emptyList()
            return ComponentStyleReferencesTable.selectAll().where {
                (ComponentStyleReferencesTable.variationPropertyValueId inList variationIds) or
                    (ComponentStyleReferencesTable.styleCombinationId inList comboIds)
            }.toList()
        }

        private fun incomingReferences(appearanceId: UUID, styles: List<UUID>): List<ResultRow> {
            if (styles.isEmpty()) return emptyList()
            val referenceIds = ComponentStyleReferenceStylesTable.selectAll()
                .where { ComponentStyleReferenceStylesTable.styleId inList styles }
                .map { it[ComponentStyleReferenceStylesTable.referenceId] }.distinct()
            if (referenceIds.isEmpty()) return emptyList()
            return ComponentStyleReferencesTable.selectAll().where {
                (ComponentStyleReferencesTable.id inList referenceIds) and
                    (ComponentStyleReferencesTable.targetAppearanceId eq appearanceId)
            }.toList()
        }

        /** Значения-владельцы входящих ссылок других оформлений со всем, что удаляется вместе с ними. */
        private fun incomingOwners(ownReferences: List<ResultRow>, incoming: List<ResultRow>): Incoming {
            fun owners(column: Column<UUID?>) = incoming.mapNotNull { it[column] }
            val invariantIds = owners(ComponentStyleReferencesTable.invariantPropertyValueId)
            val variationIds = owners(ComponentStyleReferencesTable.variationPropertyValueId)
            val comboIds = owners(ComponentStyleReferencesTable.styleCombinationId)
            return Incoming(
                references = ownReferences + incoming,
                referenceStyles = referenceStylesOf(ownReferences + incoming),
                invariantValues = InvariantPropertyValuesTable.rowsIn(InvariantPropertyValuesTable.id, invariantIds),
                invariantAdjustments = InvariantPlatformParamAdjustmentsTable.rowsIn(
                    InvariantPlatformParamAdjustmentsTable.ipvId,
                    invariantIds,
                ),
                variationValues = VariationPropertyValuesTable.rowsIn(VariationPropertyValuesTable.id, variationIds),
                variationAdjustments = VariationPlatformParamAdjustmentsTable.rowsIn(
                    VariationPlatformParamAdjustmentsTable.vpvId,
                    variationIds,
                ),
                combinations = StyleCombinationsTable.rowsIn(StyleCombinationsTable.id, comboIds),
                combinationMembers = StyleCombinationMembersTable.rowsIn(
                    StyleCombinationMembersTable.combinationId,
                    comboIds,
                ),
            )
        }

        private fun referenceStylesOf(references: List<ResultRow>): List<ResultRow> =
            ComponentStyleReferenceStylesTable.rowsIn(
                ComponentStyleReferenceStylesTable.referenceId,
                references.map { it[ComponentStyleReferencesTable.id] },
            )

        /** Строки таблицы, у которых [column] входит в [ids]; пустой набор не обращается к базе. */
        private fun Table.rowsIn(column: Column<UUID>, ids: Collection<UUID>): List<ResultRow> =
            if (ids.isEmpty()) emptyList() else selectAll().where { column inList ids }.toList()

        /** Строки таблицы по условию [predicate]; пустой [guard] не обращается к базе. */
        private fun Table.rowsOf(
            guard: Collection<UUID>,
            predicate: () -> org.jetbrains.exposed.v1.core.Op<Boolean>,
        ): List<ResultRow> = if (guard.isEmpty()) emptyList() else selectAll().where { predicate() }.toList()
    }
}
