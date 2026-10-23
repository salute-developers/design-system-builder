package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.application.DesignSystemComponentInitializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Заполняет новую дизайн-систему компонентными конфигурациями из ресурса ds-service. */
class GeneratedDesignSystemComponentInitializer : DesignSystemComponentInitializer {
    override suspend fun initialize(designSystemId: UUID) {
        if (StableDesignSystemComponentsTable.selectAll().where {
                StableDesignSystemComponentsTable.designSystemId eq designSystemId
            }.limit(1).any()
        ) {
            return
        }
        val context = validate(designSystemId) ?: return
        val writer = ComponentSeedBatchWriter(designSystemId)
        seeds.components.forEach { seed -> insertComponent(designSystemId, seed, context, writer) }
        writer.flush()
        insertDependencies(context)
    }

    private fun validate(designSystemId: UUID): SeedContext? {
        // Seeds describe the web layer: components of other platforms share names but not identity.
        val components = ComponentsTable.selectAll().where { ComponentsTable.platform eq ComponentPlatformDb.WEB }
            .associate { it[ComponentsTable.name] to it[ComponentsTable.id] }
        val requiredComponents = buildSet {
            addAll(seeds.components.map(ComponentSeed::name))
            seeds.dependencies.forEach { dependency ->
                add(dependency.parent)
                add(dependency.child)
            }
        }
        if (requiredComponents.any { it !in components }) return null

        val properties = PropertiesTable.selectAll().mapNotNull { row ->
            row[PropertiesTable.componentId]?.let { componentId ->
                PropertyKey(componentId, row[PropertiesTable.name]) to row[PropertiesTable.id]
            }
        }.toMap()
        val tokens = componentSeedTokens(designSystemId)
        val states = ComponentStatesTable.selectAll().where { ComponentStatesTable.componentId.isNull() }
            .associate { it[ComponentStatesTable.name] to it[ComponentStatesTable.id] }
        val params = PropertyPlatformParamsTable.selectAll().associate { row ->
            ParamKey(
                row[PropertyPlatformParamsTable.propertyId],
                row[PropertyPlatformParamsTable.platform].wireValue,
                row[PropertyPlatformParamsTable.name],
            ) to row[PropertyPlatformParamsTable.id]
        }

        val missingMetadata = mutableListOf<String>()
        val invalidSeedReferences = mutableListOf<String>()
        seeds.components.forEach { seed ->
            val componentId = components.getValue(seed.name)
            validateSeed(
                seed,
                componentId,
                properties,
                tokens,
                states,
                params,
                missingMetadata,
                invalidSeedReferences,
            )
        }
        require(invalidSeedReferences.isEmpty()) {
            "Component seed resource has invalid references: " +
                invalidSeedReferences.distinct().sorted().joinToString()
        }
        if (missingMetadata.isNotEmpty()) return null
        return SeedContext(components, properties, tokens, states, params)
    }

    @Suppress("CyclomaticComplexMethod", "LongParameterList", "NestedBlockDepth")
    private fun validateSeed(
        seed: ComponentSeed,
        componentId: UUID,
        properties: Map<PropertyKey, UUID>,
        tokens: Map<String, UUID>,
        states: Map<String, UUID>,
        params: Map<ParamKey, UUID>,
        missingMetadata: MutableList<String>,
        invalidSeedReferences: MutableList<String>,
    ) {
        val axes = seed.variations.associateBy(VariationSeed::name)
        val styles = seed.variations.flatMap { variation ->
            variation.styles.map { style -> StyleKey(variation.name, style.name) }
        }.toSet()
        seed.propertyVariations.forEach { binding ->
            if (PropertyKey(componentId, binding.property) !in properties) {
                missingMetadata += "${seed.name}.${binding.property}"
            }
            if (binding.variation !in axes) invalidSeedReferences += "${seed.name}.${binding.variation}"
        }
        seed.appearances.forEach { appearance ->
            validateAppearance(
                seed,
                appearance,
                componentId,
                axes,
                styles,
                properties,
                tokens,
                states,
                params,
                missingMetadata,
                invalidSeedReferences,
            )
        }
    }

    @Suppress("CyclomaticComplexMethod", "LongParameterList", "NestedBlockDepth")
    private fun validateAppearance(
        seed: ComponentSeed,
        appearance: AppearanceSeed,
        componentId: UUID,
        axes: Map<String, VariationSeed>,
        styles: Set<StyleKey>,
        properties: Map<PropertyKey, UUID>,
        tokens: Map<String, UUID>,
        states: Map<String, UUID>,
        params: Map<ParamKey, UUID>,
        missingMetadata: MutableList<String>,
        invalidSeedReferences: MutableList<String>,
    ) {
        val declared = appearance.variations ?: seed.variations.map(VariationSeed::name)
        declared.filterNot(axes::containsKey)
            .forEach { invalidSeedReferences += "${seed.name}.${appearance.name}.$it" }
        appearance.defaults.forEach { (axis, style) ->
            if (axis !in declared || StyleKey(axis, style) !in styles) {
                invalidSeedReferences += "${seed.name}.${appearance.name}.$axis.$style"
            }
        }
        appearance.values.forEach { (axis, byStyle) ->
            if (axis !in declared) invalidSeedReferences += "${seed.name}.${appearance.name}.$axis"
            byStyle.forEach { (style, values) ->
                if (StyleKey(axis, style) !in styles) invalidSeedReferences += "${seed.name}.$axis.$style"
                values.forEach {
                    validateValue(
                        seed.name,
                        componentId,
                        it,
                        properties,
                        tokens,
                        states,
                        params,
                        missingMetadata,
                        invalidSeedReferences,
                    )
                }
            }
        }
        appearance.invariants.forEach {
            validateValue(
                seed.name,
                componentId,
                it,
                properties,
                tokens,
                states,
                params,
                missingMetadata,
                invalidSeedReferences,
            )
        }
        appearance.combinations.forEach { combination ->
            validateValue(
                seed.name,
                componentId,
                combination,
                properties,
                tokens,
                states,
                params,
                missingMetadata,
                invalidSeedReferences,
            )
            combination.styles.forEach { (axis, style) ->
                if (StyleKey(axis, style) !in styles) invalidSeedReferences += "${seed.name}.$axis.$style"
            }
        }
    }

    @Suppress("LongParameterList")
    private fun validateValue(
        component: String,
        componentId: UUID,
        value: ValueSeed,
        properties: Map<PropertyKey, UUID>,
        tokens: Map<String, UUID>,
        states: Map<String, UUID>,
        params: Map<ParamKey, UUID>,
        missingMetadata: MutableList<String>,
        invalidSeedReferences: MutableList<String>,
    ) {
        val propertyId = properties[PropertyKey(componentId, value.prop)]
        if (propertyId == null) missingMetadata += "$component.${value.prop}"
        value.token?.takeUnless(tokens::containsKey)
            ?.let { invalidSeedReferences += "$component.${value.prop} token '$it'" }
        value.stateNames().filterNot(states::containsKey)
            .forEach { invalidSeedReferences += "$component.${value.prop} state '$it'" }
        if (propertyId != null) {
            value.adjust.forEach { adjustment ->
                if (ParamKey(propertyId, adjustment.platform, adjustment.param) !in params) {
                    missingMetadata += "$component.${value.prop} param '${adjustment.platform}:${adjustment.param}'"
                }
            }
        }
    }

    private fun insertComponent(
        designSystemId: UUID,
        seed: ComponentSeed,
        context: SeedContext,
        writer: ComponentSeedBatchWriter,
    ) {
        val componentId = context.components.getValue(seed.name)
        val linkId = writer.stable(
            StableDesignSystemComponentsTable,
            StableDesignSystemComponentsTable.id,
            StableDesignSystemComponentsTable.createdAt,
        ) {
            it[StableDesignSystemComponentsTable.designSystemId] = designSystemId
            it[StableDesignSystemComponentsTable.componentId] = componentId
        }
        writer.revision(DesignSystemComponentRevisionsTable, DesignSystemComponentRevisionsTable.entityId, linkId)

        check(seed.variations.map { it.name }.distinct().size == seed.variations.size) {
            "Component seed '${seed.name}' declares variations with duplicate names"
        }
        val variations = seed.variations.associate { variation ->
            val id = writer.stable(StableVariationsTable, StableVariationsTable.id, StableVariationsTable.createdAt) {
                it[StableVariationsTable.designSystemId] = designSystemId
                it[StableVariationsTable.componentId] = componentId
            }
            writer.revision(VariationRevisionsTable, VariationRevisionsTable.entityId, id) { statement ->
                statement[name] = variation.name
                statement[description] = variation.description.orEmpty()
            }
            variation.name to id
        }
        seed.propertyVariations.map { binding ->
            context.property(seed.name, binding.property) to variations.getValue(binding.variation)
        }.distinct().forEach { (propertyId, variationId) ->
            writer.stable(
                StablePropertyVariationsTable,
                StablePropertyVariationsTable.id,
                StablePropertyVariationsTable.createdAt,
            ) {
                it[StablePropertyVariationsTable.propertyId] = propertyId
                it[StablePropertyVariationsTable.variationId] = variationId
                it[StablePropertyVariationsTable.designSystemId] = designSystemId
            }
        }

        val styles = seed.variations.flatMap { variation ->
            variation.styles.map { style ->
                val id = writer.stable(StableStylesTable, StableStylesTable.id, StableStylesTable.createdAt) {
                    it[StableStylesTable.designSystemId] = designSystemId
                    it[variationId] = variations.getValue(variation.name)
                }
                writer.revision(StyleRevisionsTable, StyleRevisionsTable.entityId, id) { statement ->
                    statement[name] = style.name
                    statement[description] = style.description.orEmpty()
                }
                StyleKey(variation.name, style.name) to id
            }
        }.toMap()

        insertAppearances(designSystemId, seed, componentId, variations, styles, context, writer)
    }

    /** Конфигурация по умолчанию — оформление с именем компонента, а при его отсутствии первое. */
    @Suppress("LongParameterList")
    private fun insertAppearances(
        designSystemId: UUID,
        seed: ComponentSeed,
        componentId: UUID,
        variations: Map<String, UUID>,
        styles: Map<StyleKey, UUID>,
        context: SeedContext,
        writer: ComponentSeedBatchWriter,
    ) {
        val defaultAppearance = seed.appearances.firstOrNull { it.name.equals(seed.name, ignoreCase = true) }
            ?: seed.appearances.firstOrNull()
        seed.appearances.forEach { appearance ->
            insertAppearance(
                designSystemId, seed, appearance, componentId, variations, styles, context, writer,
                isDefault = appearance === defaultAppearance,
            )
        }
    }

    @Suppress("LongMethod", "LongParameterList")
    private fun insertAppearance(
        designSystemId: UUID,
        seed: ComponentSeed,
        appearance: AppearanceSeed,
        componentId: UUID,
        variations: Map<String, UUID>,
        styles: Map<StyleKey, UUID>,
        context: SeedContext,
        writer: ComponentSeedBatchWriter,
        isDefault: Boolean,
    ) {
        val appearanceId = writer.stable(
            StableAppearancesTable,
            StableAppearancesTable.id,
            StableAppearancesTable.createdAt,
        ) {
            it[StableAppearancesTable.designSystemId] = designSystemId
            it[StableAppearancesTable.componentId] = componentId
        }
        writer.revision(AppearanceRevisionsTable, AppearanceRevisionsTable.entityId, appearanceId) { statement ->
            statement[name] = appearance.name
            statement[rootVariationId] = null
            statement[colorSchemeVariationId] = null
            statement[AppearanceRevisionsTable.isDefault] = isDefault
        }
        val declared = appearance.variations ?: seed.variations.map(VariationSeed::name)
        declared.forEachIndexed { position, axis ->
            val rowId = writer.stable(
                StableAppearanceVariationsTable,
                StableAppearanceVariationsTable.id,
                StableAppearanceVariationsTable.createdAt,
            ) {
                it[StableAppearanceVariationsTable.appearanceId] = appearanceId
                it[variationId] = variations.getValue(axis)
                it[StableAppearanceVariationsTable.designSystemId] = designSystemId
            }
            writer.revision(
                AppearanceVariationRevisionsTable,
                AppearanceVariationRevisionsTable.entityId,
                rowId,
            ) { statement ->
                statement[AppearanceVariationRevisionsTable.position] = position
                statement[defaultStyleId] = appearance.defaults[axis]?.let { styles.getValue(StyleKey(axis, it)) }
                statement[declaredType] = null
            }
            seed.variations.first { it.name == axis }.styles.forEachIndexed { stylePosition, style ->
                val valueId = writer.stable(
                    StableAppearanceVariationValuesTable,
                    StableAppearanceVariationValuesTable.id,
                    StableAppearanceVariationValuesTable.createdAt,
                ) {
                    it[appearanceVariationId] = rowId
                    it[StableAppearanceVariationValuesTable.designSystemId] = designSystemId
                }
                writer.revision(
                    AppearanceVariationValueRevisionsTable,
                    AppearanceVariationValueRevisionsTable.entityId,
                    valueId,
                ) { statement ->
                    statement[styleId] = styles.getValue(StyleKey(axis, style.name))
                    statement[AppearanceVariationValueRevisionsTable.position] = stylePosition
                    statement[authoredId] = null
                }
            }
        }

        appearance.values.forEach { (axis, byStyle) ->
            byStyle.forEach { (style, values) ->
                values.forEach { value ->
                    val valueId = writer.stable(
                        StableVariationPropertyValuesTable,
                        StableVariationPropertyValuesTable.id,
                        StableVariationPropertyValuesTable.createdAt,
                    ) {
                        it[propertyId] = context.property(seed.name, value.prop)
                        it[styleId] = styles.getValue(StyleKey(axis, style))
                        it[StableVariationPropertyValuesTable.appearanceId] = appearanceId
                        it[StableVariationPropertyValuesTable.designSystemId] = designSystemId
                    }
                    writer.revision(
                        VariationPropertyValueRevisionsTable,
                        VariationPropertyValueRevisionsTable.entityId,
                        valueId,
                    ) { statement ->
                        val token = value.token?.let(context.tokens::getValue)
                        statement[tokenId] = token
                        statement[VariationPropertyValueRevisionsTable.value] = value.value.takeIf { token == null }
                        statement[alpha] = null
                        statement[adjustment] = null
                        statement[position] = 0
                        statement[stateSetId] = context.stateSet(value.stateNames())
                    }
                    insertVariationAdjustments(valueId, designSystemId, seed.name, value, context, writer)
                }
            }
        }
        appearance.invariants.forEach { value ->
            val valueId = writer.stable(
                StableInvariantPropertyValuesTable,
                StableInvariantPropertyValuesTable.id,
                StableInvariantPropertyValuesTable.createdAt,
            ) {
                it[propertyId] = context.property(seed.name, value.prop)
                it[StableInvariantPropertyValuesTable.designSystemId] = designSystemId
                it[StableInvariantPropertyValuesTable.componentId] = componentId
                it[StableInvariantPropertyValuesTable.appearanceId] = appearanceId
            }
            writer.revision(
                InvariantPropertyValueRevisionsTable,
                InvariantPropertyValueRevisionsTable.entityId,
                valueId,
            ) { statement ->
                val token = value.token?.let(context.tokens::getValue)
                statement[tokenId] = token
                statement[InvariantPropertyValueRevisionsTable.value] = value.value.takeIf { token == null }
                statement[alpha] = null
                statement[adjustment] = null
                statement[position] = 0
                statement[stateSetId] = context.stateSet(value.stateNames())
            }
            insertInvariantAdjustments(valueId, designSystemId, seed.name, value, context, writer)
        }
        appearance.combinations.forEach { combination ->
            val members = combination.styles.map { (axis, style) -> styles.getValue(StyleKey(axis, style)) }
            val rowId = writer.stable(
                StableStyleCombinationsTable,
                StableStyleCombinationsTable.id,
                StableStyleCombinationsTable.createdAt,
            ) {
                it[propertyId] = context.property(seed.name, combination.prop)
                it[StableStyleCombinationsTable.appearanceId] = appearanceId
                it[StableStyleCombinationsTable.designSystemId] = designSystemId
            }
            writer.revision(
                StyleCombinationRevisionsTable,
                StyleCombinationRevisionsTable.entityId,
                rowId,
            ) { statement ->
                statement[combinationKey] = members.sorted().joinToString(",")
                statement[StyleCombinationRevisionsTable.value] = combination.value ?: combination.token.orEmpty()
                statement[tokenId] = combination.token?.let(context.tokens::getValue)
                statement[alpha] = null
                statement[adjustment] = null
                statement[position] = 0
                statement[stateSetId] = EMPTY_STATE_SET_ID
            }
            members.forEach { styleId ->
                val memberId = writer.stable(
                    StableStyleCombinationMembersTable,
                    StableStyleCombinationMembersTable.id,
                    StableStyleCombinationMembersTable.createdAt,
                ) {
                    it[combinationId] = rowId
                    it[StableStyleCombinationMembersTable.designSystemId] = designSystemId
                }
                writer.revision(
                    StyleCombinationMemberRevisionsTable,
                    StyleCombinationMemberRevisionsTable.entityId,
                    memberId,
                ) { statement -> statement[StyleCombinationMemberRevisionsTable.styleId] = styleId }
            }
        }
    }

    private fun insertVariationAdjustments(
        id: UUID,
        designSystemId: UUID,
        component: String,
        value: ValueSeed,
        context: SeedContext,
        writer: ComponentSeedBatchWriter,
    ) {
        value.adjust.forEach { adjustment ->
            val adjustmentId = writer.stable(
                StableVariationPlatformParamAdjustmentsTable,
                StableVariationPlatformParamAdjustmentsTable.id,
                StableVariationPlatformParamAdjustmentsTable.createdAt,
            ) {
                it[vpvId] = id
                it[platformParamId] = context.param(component, value.prop, adjustment)
                it[StableVariationPlatformParamAdjustmentsTable.designSystemId] = designSystemId
            }
            writer.revision(
                VariationPlatformParamAdjustmentRevisionsTable,
                VariationPlatformParamAdjustmentRevisionsTable.entityId,
                adjustmentId,
            ) { statement ->
                statement[VariationPlatformParamAdjustmentRevisionsTable.value] = adjustment.value
                statement[template] = adjustment.template
            }
        }
    }

    private fun insertInvariantAdjustments(
        id: UUID,
        designSystemId: UUID,
        component: String,
        value: ValueSeed,
        context: SeedContext,
        writer: ComponentSeedBatchWriter,
    ) {
        value.adjust.forEach { adjustment ->
            val adjustmentId = writer.stable(
                StableInvariantPlatformParamAdjustmentsTable,
                StableInvariantPlatformParamAdjustmentsTable.id,
                StableInvariantPlatformParamAdjustmentsTable.createdAt,
            ) {
                it[ipvId] = id
                it[platformParamId] = context.param(component, value.prop, adjustment)
                it[StableInvariantPlatformParamAdjustmentsTable.designSystemId] = designSystemId
            }
            writer.revision(
                InvariantPlatformParamAdjustmentRevisionsTable,
                InvariantPlatformParamAdjustmentRevisionsTable.entityId,
                adjustmentId,
            ) { statement ->
                statement[InvariantPlatformParamAdjustmentRevisionsTable.value] = adjustment.value
                statement[template] = adjustment.template
            }
        }
    }

    private fun insertDependencies(context: SeedContext) {
        seeds.dependencies.forEach { dependency ->
            val parent = context.components.getValue(dependency.parent)
            val child = context.components.getValue(dependency.child)
            val existing = ComponentDependenciesTable.selectAll().where {
                (ComponentDependenciesTable.parentId eq parent) and (ComponentDependenciesTable.childId eq child)
            }.singleOrNull()
            if (existing == null) {
                ComponentDependenciesTable.insertReturning {
                    it[parentId] = parent
                    it[childId] = child
                    it[type] = requireNotNull(RelationTypeDb.fromWire(dependency.type))
                    it[order] = dependency.order
                }.single()
            }
        }
    }

    private val seeds: ComponentSeedPackage by lazy {
        val text = requireNotNull(javaClass.classLoader.getResourceAsStream("component-seeds.json")) {
            "Component seed resource is missing"
        }.bufferedReader().use { it.readText() }
        Json.decodeFromString<ComponentSeedPackage>(text)
    }

    private data class SeedContext(
        val components: Map<String, UUID>,
        val properties: Map<PropertyKey, UUID>,
        val tokens: Map<String, UUID>,
        val states: Map<String, UUID>,
        val params: Map<ParamKey, UUID>,
        val stateSets: MutableMap<List<UUID>, UUID> = mutableMapOf(emptyList<UUID>() to EMPTY_STATE_SET_ID),
    ) {
        fun property(component: String, property: String): UUID =
            properties.getValue(PropertyKey(components.getValue(component), property))

        fun param(component: String, property: String, adjustment: AdjustmentSeed): UUID = params.getValue(
            ParamKey(property(component, property), adjustment.platform, adjustment.param),
        )

        fun stateSet(names: List<String>): UUID {
            val ids = names.map(states::getValue).distinct().sorted()
            return stateSets.getOrPut(ids) {
                ComponentStateSetsTable.selectAll().firstOrNull { it[ComponentStateSetsTable.stateIds] == ids }
                    ?.get(ComponentStateSetsTable.id)
                    ?: ComponentStateSetsTable.insertReturning {
                        it[stateIds] = ids
                        it[ownerComponentId] = null
                    }.single()[ComponentStateSetsTable.id]
            }
        }
    }

    private companion object {
        val EMPTY_STATE_SET_ID: UUID = UUID.fromString("00000000-0000-4000-8000-0000000000ff")
    }
}

private data class PropertyKey(val componentId: UUID, val name: String)
private data class ParamKey(val propertyId: UUID, val platform: String, val name: String)
private data class StyleKey(val variation: String, val style: String)

@Serializable
private data class ComponentSeedPackage(
    val components: List<ComponentSeed>,
    val dependencies: List<DependencySeed> = emptyList(),
)

@Serializable
private data class ComponentSeed(
    val name: String,
    val propertyVariations: List<PropertyVariationSeed> = emptyList(),
    val variations: List<VariationSeed> = emptyList(),
    val appearances: List<AppearanceSeed> = emptyList(),
)

@Serializable
private data class PropertyVariationSeed(val property: String, val variation: String)

@Serializable
private data class VariationSeed(
    val name: String,
    val description: String? = null,
    val styles: List<StyleSeed> = emptyList(),
)

@Serializable
private data class StyleSeed(val name: String, val description: String? = null)

@Serializable
private data class AppearanceSeed(
    val name: String,
    val variations: List<String>? = null,
    val defaults: Map<String, String> = emptyMap(),
    val values: Map<String, Map<String, List<ValueSeed>>> = emptyMap(),
    val invariants: List<ValueSeed> = emptyList(),
    val combinations: List<ValueSeed> = emptyList(),
)

@Serializable
private data class ValueSeed(
    val prop: String,
    val token: String? = null,
    val value: String? = null,
    val state: kotlinx.serialization.json.JsonElement? = null,
    val adjust: List<AdjustmentSeed> = emptyList(),
    val styles: Map<String, String> = emptyMap(),
) {
    fun stateNames(): List<String> = when (state) {
        null -> emptyList()
        is JsonArray -> state.map { it.jsonPrimitive.content }
        else -> listOf(state.jsonPrimitive.content)
    }
}

@Serializable
private data class AdjustmentSeed(
    val platform: String,
    val param: String,
    val value: String? = null,
    val template: String? = null,
)

@Serializable
private data class DependencySeed(
    val parent: String,
    val child: String,
    val type: String,
    val order: Int,
)
