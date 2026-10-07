package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.domain.ComponentConfig
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Builds the common component-config model from the normalized legacy schema. */
internal class ComponentConfigBuilder {
    fun build(appearance: ConfigAppearance, exported: Boolean, underived: MutableSet<String>): ComponentConfig {
        val roles = AppearanceAxisRoleStore.load(listOf(appearance.id))[appearance.id]
        val axes = axes(appearance.id, roles?.colorScheme)
        val stateNames = stateNames()
        val invariants = valueRows(appearance, invariant = true, stateNames = stateNames)
        val variationValues = valueRows(appearance, invariant = false, stateNames = stateNames)
        val combinations = combinations(appearance, axes, stateNames, exported)
        val where = "${camelToKebab(appearance.componentName)}.${appearance.name ?: "default"}"
        val idOf: (ConfigAxis) -> String = { if (exported) it.name else it.variationId.toString() }

        return ComponentConfig(
            rootVariationId = axes.firstOrNull { it.variationId == roles?.root }?.let(idOf),
            colorSchemeVariationId = axes.firstOrNull { it.colorScheme }?.let(idOf),
            invariants = properties(invariants, where, exported, underived),
            defaults = axes.mapNotNull { axis ->
                val value = axis.values.firstOrNull { it.styleId == axis.defaultStyleId } ?: return@mapNotNull null
                ComponentConfig.Default(idOf(axis), axisScalar(axis, value.name))
            },
            variations = axes.map { axis ->
                ComponentConfig.Variation(
                    idOf(axis),
                    axis.name,
                    axis.values.flatMap { value ->
                        val own = variationValues.filter { it.styleId == value.styleId }
                        val direct = ComponentConfig.VariationValue(
                            value.name,
                            properties = properties(own, where, exported, underived),
                            authoredId = value.authoredId.takeIf { exported },
                        )
                        val crossed = combinations.filter { it.ownerStyleId == value.styleId }.map { combination ->
                            ComponentConfig.VariationValue(
                                value.name,
                                targets = listOf(
                                    ComponentConfig.Target(
                                        combination.members.filter { it.styleId != value.styleId }.map { member ->
                                            val targetAxis = axes.firstOrNull { it.variationId == member.variationId }
                                            ComponentConfig.TargetProperty(
                                                targetAxis?.let(idOf) ?: member.variationId.toString(),
                                                targetAxis?.let { axisScalar(it, member.styleName) }
                                                    ?: ComponentConfig.Scalar.Text(member.styleName),
                                            )
                                        },
                                    ),
                                ),
                                properties = properties(combination.rows, where, exported, underived),
                                authoredId = combination.authoredId.takeIf { exported },
                            )
                        }
                        listOf(direct) + crossed
                    },
                    axis.declaredType.takeIf { exported },
                )
            },
        )
    }

    private fun axes(appearanceId: UUID, colorScheme: UUID?): List<ConfigAxis> =
        AppearanceVariationsTable.innerJoin(VariationsTable).selectAll()
            .where { AppearanceVariationsTable.appearanceId eq appearanceId }
            .orderBy(AppearanceVariationsTable.position)
            .map { row ->
                val axisId = row[AppearanceVariationsTable.id]
                ConfigAxis(
                    row[AppearanceVariationsTable.variationId],
                    row[VariationsTable.name],
                    row[AppearanceVariationsTable.defaultStyleId],
                    row[AppearanceVariationsTable.variationId] == colorScheme,
                    row[AppearanceVariationsTable.declaredType],
                    AppearanceVariationValuesTable.innerJoin(ComponentStylesTable).selectAll()
                        .where { AppearanceVariationValuesTable.appearanceVariationId eq axisId }
                        .orderBy(AppearanceVariationValuesTable.position)
                        .map {
                            ConfigAxisValue(
                                it[AppearanceVariationValuesTable.styleId],
                                it[ComponentStylesTable.name],
                                it[AppearanceVariationValuesTable.authoredId],
                            )
                        },
                    row[AppearanceVariationsTable.position],
                )
            }

    private fun stateNames(): Map<UUID, List<String>> {
        val names = ComponentStatesTable.selectAll().associate {
            it[ComponentStatesTable.id] to it[ComponentStatesTable.name]
        }
        return ComponentStateSetsTable.selectAll().associate { row ->
            row[ComponentStateSetsTable.id] to row[ComponentStateSetsTable.stateIds].mapNotNull(names::get).sorted()
        }
    }

    private fun valueRows(
        appearance: ConfigAppearance,
        invariant: Boolean,
        stateNames: Map<UUID, List<String>>,
    ): List<ConfigValueRow> = if (invariant) {
        InvariantPropertyValuesTable.innerJoin(PropertiesTable)
            .join(
                ComponentTokensTable,
                JoinType.LEFT,
                additionalConstraint = { InvariantPropertyValuesTable.tokenId eq ComponentTokensTable.id },
            )
            .selectAll().where {
                (InvariantPropertyValuesTable.designSystemId eq appearance.designSystemId) and
                    (InvariantPropertyValuesTable.componentId eq appearance.componentId) and
                    (InvariantPropertyValuesTable.appearanceId eq appearance.id)
            }.orderBy(
                PropertiesTable.name to SortOrder.ASC,
                InvariantPropertyValuesTable.position to SortOrder.ASC,
            ).map { valueRow(it, true, stateNames) }
    } else {
        VariationPropertyValuesTable.innerJoin(PropertiesTable)
            .join(
                ComponentTokensTable,
                JoinType.LEFT,
                additionalConstraint = { VariationPropertyValuesTable.tokenId eq ComponentTokensTable.id },
            )
            .selectAll().where { VariationPropertyValuesTable.appearanceId eq appearance.id }
            .orderBy(
                PropertiesTable.name to SortOrder.ASC,
                VariationPropertyValuesTable.styleId to SortOrder.ASC,
                VariationPropertyValuesTable.position to SortOrder.ASC,
            ).map { valueRow(it, false, stateNames) }
    }

    private fun valueRow(row: ResultRow, invariant: Boolean, states: Map<UUID, List<String>>): ConfigValueRow {
        val propertyId = row[PropertiesTable.id]
        val stateSetId = if (invariant) {
            row[InvariantPropertyValuesTable.stateSetId]
        } else {
            row[VariationPropertyValuesTable.stateSetId]
        }
        return ConfigValueRow(
            propertyId,
            row[PropertiesTable.name],
            row[PropertiesTable.type].wireValue,
            if (invariant) null else row[VariationPropertyValuesTable.styleId],
            if (invariant) row[InvariantPropertyValuesTable.value] else row[VariationPropertyValuesTable.value],
            if (invariant) row[InvariantPropertyValuesTable.alpha] else row[VariationPropertyValuesTable.alpha],
            if (invariant) {
                row[InvariantPropertyValuesTable.adjustment]
            } else {
                row[VariationPropertyValuesTable.adjustment]
            },
            if (invariant) row[InvariantPropertyValuesTable.position] else row[VariationPropertyValuesTable.position],
            row.getOrNull(ComponentTokensTable.name),
            row.getOrNull(ComponentTokensTable.type),
            states[stateSetId].orEmpty(),
        )
    }

    private fun combinations(
        appearance: ConfigAppearance,
        axes: List<ConfigAxis>,
        states: Map<UUID, List<String>>,
        exported: Boolean,
    ): List<ConfigCombination> {
        val values = StyleCombinationsTable.innerJoin(PropertiesTable)
            .join(
                ComponentTokensTable,
                JoinType.LEFT,
                additionalConstraint = { StyleCombinationsTable.tokenId eq ComponentTokensTable.id },
            )
            .selectAll().where { StyleCombinationsTable.appearanceId eq appearance.id }.toList()
        val byKey = values.groupBy { it[StyleCombinationsTable.combinationKey] }
        val storedMembers = values.groupBy { it[StyleCombinationsTable.combinationKey] }.mapValues { (_, rows) ->
            val ids = rows.map { it[StyleCombinationsTable.id] }
            StyleCombinationMembersTable.innerJoin(ComponentStylesTable).selectAll()
                .filter { it[StyleCombinationMembersTable.combinationId] in ids }
                .map(::combinationMember).distinctBy { it.styleId }
        }
        val declared = AppearanceCombinationsTable.selectAll()
            .where { AppearanceCombinationsTable.appearanceId eq appearance.id }
            .orderBy(AppearanceCombinationsTable.position).map { row ->
                val id = row[AppearanceCombinationsTable.id]
                val members = AppearanceCombinationMembersTable.innerJoin(ComponentStylesTable).selectAll()
                    .where { AppearanceCombinationMembersTable.appearanceCombinationId eq id }
                    .orderBy(AppearanceCombinationMembersTable.position).map(::declaredMember)
                Triple(
                    row[AppearanceCombinationsTable.combinationKey],
                    row[AppearanceCombinationsTable.authoredId],
                    members,
                )
            }
        // Declared order first; undeclared keys sorted so the export does not depend on physical row order.
        val keys = (declared.map { it.first } + byKey.keys.sorted()).distinct()
        return keys.mapNotNull { key ->
            val declaration = declared.firstOrNull { it.first == key }
            val stored = declaration?.third ?: storedMembers[key].orEmpty()
            // Stored member order follows random style ids; the export orders them by axis, then by name,
            // so that the same configuration is exported identically whatever ids the rows received.
            val members = if (exported) {
                val axisPosition = axes.associate { it.variationId to it.position }
                stored.sortedWith(
                    compareBy({ axisPosition[it.variationId] ?: Int.MAX_VALUE }, { it.styleName }),
                )
            } else {
                stored
            }
            val owner = owner(members, axes, exported) ?: return@mapNotNull null
            ConfigCombination(
                owner.styleId,
                members,
                byKey[key].orEmpty().sortedWith(
                    compareBy({ it[PropertiesTable.name] }, { it[StyleCombinationsTable.position] }),
                ).map { row ->
                    ConfigValueRow(
                        row[PropertiesTable.id], row[PropertiesTable.name], row[PropertiesTable.type].wireValue, null,
                        row[StyleCombinationsTable.value], row[StyleCombinationsTable.alpha],
                        row[StyleCombinationsTable.adjustment], row[StyleCombinationsTable.position],
                        row.getOrNull(ComponentTokensTable.name), row.getOrNull(ComponentTokensTable.type),
                        states[row[StyleCombinationsTable.stateSetId]].orEmpty(),
                    )
                },
                declaration?.second,
            )
        }
    }

    private fun combinationMember(row: ResultRow) = ConfigMember(
        row[StyleCombinationMembersTable.styleId],
        row[ComponentStylesTable.variationId],
        row[ComponentStylesTable.name],
    )

    private fun declaredMember(row: ResultRow) = ConfigMember(
        row[AppearanceCombinationMembersTable.styleId],
        row[ComponentStylesTable.variationId],
        row[ComponentStylesTable.name],
    )

    private fun owner(members: List<ConfigMember>, axes: List<ConfigAxis>, exported: Boolean): ConfigMember? {
        members.firstOrNull { member -> axes.any { it.colorScheme && it.variationId == member.variationId } }?.let {
            return it
        }
        return if (exported) {
            members.maxByOrNull { member -> axes.firstOrNull { it.variationId == member.variationId }?.position ?: -1 }
        } else {
            members.minByOrNull { it.styleId.toString() }
        }
    }

    private fun properties(
        rows: List<ConfigValueRow>,
        where: String,
        exported: Boolean,
        underived: MutableSet<String>,
    ): Map<String, ComponentConfig.Property> =
        rows.groupBy { it.propertyName }.toSortedMap().mapNotNull { (name, values) ->
            val base = values.firstOrNull { it.states.isEmpty() } ?: return@mapNotNull null
            name to property(base, values, where, exported, underived)
        }.toMap(linkedMapOf())

    private fun property(
        base: ConfigValueRow,
        rows: List<ConfigValueRow>,
        where: String,
        exported: Boolean,
        underived: MutableSet<String>,
    ): ComponentConfig.Property {
        val type = derivedType(base, "$where.${base.propertyName}", underived)
        return ComponentConfig.Property(
            base.propertyId.toString().takeUnless { exported },
            type,
            restored(base.value ?: base.tokenName, type),
            base.alpha?.let(::number),
            base.adjustment?.let(::number),
            rows.filter { it.states.isNotEmpty() }.sortedBy { it.position }.map { row ->
                val stateType = derivedType(row, "$where.${row.propertyName}", underived)
                ComponentConfig.State(
                    row.states,
                    restored(row.value ?: row.tokenName, stateType),
                    row.alpha?.let(::number),
                    stateType.takeIf { it != type },
                )
            },
        )
    }

    private fun derivedType(row: ConfigValueRow, where: String, underived: MutableSet<String>): String {
        if (row.propertyType == "color" && row.tokenName != null && row.tokenType == null) underived += where
        return if (row.propertyType == "color" && row.tokenType == "gradient") "gradient" else row.propertyType
    }

    private fun restored(value: String?, type: String): ComponentConfig.Scalar = when {
        value == null -> ComponentConfig.Scalar.Null
        type in numericTypes && value.toDoubleOrNull() != null -> number(value)
        type == "boolean" && value in setOf("true", "false") -> ComponentConfig.Scalar.BooleanValue(value.toBoolean())
        else -> ComponentConfig.Scalar.Text(value)
    }

    private fun number(value: String) = ComponentConfig.Scalar.Number(value)

    private fun axisScalar(axis: ConfigAxis, value: String): ComponentConfig.Scalar {
        val names = axis.values.map { it.name }.toSet()
        return if (names == setOf("true", "false")) {
            ComponentConfig.Scalar.BooleanValue(value.toBoolean())
        } else {
            ComponentConfig.Scalar.Text(value)
        }
    }

    private companion object {
        val numericTypes = setOf("dimension", "float", "integer")
    }
}

internal data class ConfigAppearance(
    val id: UUID,
    val designSystemId: UUID,
    val componentId: UUID,
    val componentName: String,
    val name: String?,
)

private data class ConfigAxis(
    val variationId: UUID,
    val name: String,
    val defaultStyleId: UUID?,
    val colorScheme: Boolean,
    val declaredType: String?,
    val values: List<ConfigAxisValue>,
    val position: Int,
)

private data class ConfigAxisValue(val styleId: UUID, val name: String, val authoredId: String?)

private data class ConfigValueRow(
    val propertyId: UUID,
    val propertyName: String,
    val propertyType: String,
    val styleId: UUID?,
    val value: String?,
    val alpha: String?,
    val adjustment: String?,
    val position: Int,
    val tokenName: String?,
    val tokenType: String?,
    val states: List<String>,
)

private data class ConfigMember(val styleId: UUID, val variationId: UUID, val styleName: String)

private data class ConfigCombination(
    val ownerStyleId: UUID,
    val members: List<ConfigMember>,
    val rows: List<ConfigValueRow>,
    val authoredId: String?,
)

internal fun camelToKebab(value: String): String = value
    .replace(Regex("([a-z0-9])([A-Z])"), "\$1-\$2")
    .replace(Regex("([A-Z])([A-Z][a-z])"), "\$1-\$2")
    .lowercase()

internal fun techToCamelCase(value: String): String = value.split('.', '-').joinToString("") {
    it.replaceFirstChar(Char::uppercase)
}
