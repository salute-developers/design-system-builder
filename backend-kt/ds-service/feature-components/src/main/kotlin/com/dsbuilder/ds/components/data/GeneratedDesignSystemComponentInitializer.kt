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
import org.jetbrains.exposed.v1.jdbc.update
import java.util.UUID

/** Заполняет новую дизайн-систему компонентными конфигурациями из ресурса ds-service. */
class GeneratedDesignSystemComponentInitializer : DesignSystemComponentInitializer {
    override suspend fun initialize(designSystemId: UUID) {
        if (DesignSystemComponentsTable.selectAll().where {
                DesignSystemComponentsTable.designSystemId eq designSystemId
            }.limit(1).any()
        ) {
            return
        }
        val context = validate(designSystemId) ?: return
        seeds.components.forEach { seed -> insertComponent(designSystemId, seed, context) }
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
        val tokens = ComponentTokensTable.selectAll().where {
            ComponentTokensTable.designSystemId eq designSystemId
        }.associate { it[ComponentTokensTable.name] to it[ComponentTokensTable.id] }
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

    private fun insertComponent(designSystemId: UUID, seed: ComponentSeed, context: SeedContext) {
        val componentId = context.components.getValue(seed.name)
        DesignSystemComponentsTable.insertReturning {
            it[DesignSystemComponentsTable.designSystemId] = designSystemId
            it[DesignSystemComponentsTable.componentId] = componentId
        }.single()

        val variations = seed.variations.associate { variation ->
            val existing = VariationsTable.selectAll().where {
                (VariationsTable.componentId eq componentId) and (VariationsTable.name eq variation.name)
            }.singleOrNull()
            val id = existing?.get(VariationsTable.id) ?: VariationsTable.insertReturning {
                it[VariationsTable.componentId] = componentId
                it[name] = variation.name
                it[description] = variation.description.orEmpty()
            }.single()[VariationsTable.id]
            if (existing != null) {
                VariationsTable.update({ VariationsTable.id eq id }) {
                    it[description] = variation.description.orEmpty()
                }
            }
            variation.name to id
        }
        seed.propertyVariations.forEach { binding ->
            val propertyId = context.property(seed.name, binding.property)
            val variationId = variations.getValue(binding.variation)
            if (!PropertyVariationsTable.selectAll().where {
                    (PropertyVariationsTable.propertyId eq propertyId) and
                        (PropertyVariationsTable.variationId eq variationId)
                }.any()
            ) {
                PropertyVariationsTable.insertReturning {
                    it[PropertyVariationsTable.propertyId] = propertyId
                    it[PropertyVariationsTable.variationId] = variationId
                }.single()
            }
        }

        val styles = seed.variations.flatMap { variation ->
            variation.styles.map { style ->
                val id = ComponentStylesTable.insertReturning {
                    it[ComponentStylesTable.designSystemId] = designSystemId
                    it[variationId] = variations.getValue(variation.name)
                    it[name] = style.name
                    it[description] = style.description.orEmpty()
                }.single()[ComponentStylesTable.id]
                StyleKey(variation.name, style.name) to id
            }
        }.toMap()

        seed.appearances.forEach { appearance ->
            insertAppearance(designSystemId, seed, appearance, componentId, variations, styles, context)
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
    ) {
        val appearanceId = ComponentAppearancesTable.insertReturning {
            it[ComponentAppearancesTable.designSystemId] = designSystemId
            it[ComponentAppearancesTable.componentId] = componentId
            it[name] = appearance.name
        }.single()[ComponentAppearancesTable.id]
        val declared = appearance.variations ?: seed.variations.map(VariationSeed::name)
        declared.forEachIndexed { position, axis ->
            val rowId = AppearanceVariationsTable.insertReturning {
                it[AppearanceVariationsTable.appearanceId] = appearanceId
                it[variationId] = variations.getValue(axis)
                it[AppearanceVariationsTable.position] = position
                it[defaultStyleId] = appearance.defaults[axis]?.let { styles.getValue(StyleKey(axis, it)) }
                it[isColorScheme] = false
                it[declaredType] = null
            }.single()[AppearanceVariationsTable.id]
            seed.variations.first { it.name == axis }.styles.forEachIndexed { stylePosition, style ->
                AppearanceVariationValuesTable.insertReturning {
                    it[appearanceVariationId] = rowId
                    it[styleId] = styles.getValue(StyleKey(axis, style.name))
                    it[AppearanceVariationValuesTable.position] = stylePosition
                    it[authoredId] = null
                }.single()
            }
        }

        appearance.values.forEach { (axis, byStyle) ->
            byStyle.forEach { (style, values) ->
                values.forEach { value ->
                    val valueId = VariationPropertyValuesTable.insertReturning {
                        it[propertyId] = context.property(seed.name, value.prop)
                        it[styleId] = styles.getValue(StyleKey(axis, style))
                        it[VariationPropertyValuesTable.appearanceId] = appearanceId
                        it[tokenId] = value.token?.let(context.tokens::getValue)
                        it[VariationPropertyValuesTable.value] = value.value
                        it[alpha] = null
                        it[adjustment] = null
                        it[VariationPropertyValuesTable.position] = 0
                        it[stateSetId] = context.stateSet(value.stateNames())
                    }.single()[VariationPropertyValuesTable.id]
                    insertVariationAdjustments(valueId, seed.name, value, context)
                }
            }
        }
        appearance.invariants.forEach { value ->
            val valueId = InvariantPropertyValuesTable.insertReturning {
                it[propertyId] = context.property(seed.name, value.prop)
                it[InvariantPropertyValuesTable.designSystemId] = designSystemId
                it[InvariantPropertyValuesTable.componentId] = componentId
                it[InvariantPropertyValuesTable.appearanceId] = appearanceId
                it[tokenId] = value.token?.let(context.tokens::getValue)
                it[InvariantPropertyValuesTable.value] = value.value
                it[alpha] = null
                it[adjustment] = null
                it[InvariantPropertyValuesTable.position] = 0
                it[stateSetId] = context.stateSet(value.stateNames())
            }.single()[InvariantPropertyValuesTable.id]
            insertInvariantAdjustments(valueId, seed.name, value, context)
        }
        appearance.combinations.forEach { combination ->
            val members = combination.styles.map { (axis, style) -> styles.getValue(StyleKey(axis, style)) }
            val rowId = StyleCombinationsTable.insertReturning {
                it[propertyId] = context.property(seed.name, combination.prop)
                it[StyleCombinationsTable.appearanceId] = appearanceId
                it[combinationKey] = members.sorted().joinToString(",")
                it[StyleCombinationsTable.value] = combination.value ?: combination.token.orEmpty()
                it[tokenId] = combination.token?.let(context.tokens::getValue)
                it[alpha] = null
                it[adjustment] = null
                it[StyleCombinationsTable.position] = 0
                it[stateSetId] = EMPTY_STATE_SET_ID
            }.single()[StyleCombinationsTable.id]
            members.forEach { styleId ->
                StyleCombinationMembersTable.insertReturning {
                    it[combinationId] = rowId
                    it[StyleCombinationMembersTable.styleId] = styleId
                }.single()
            }
        }
    }

    private fun insertVariationAdjustments(id: UUID, component: String, value: ValueSeed, context: SeedContext) {
        value.adjust.forEach { adjustment ->
            VariationPlatformParamAdjustmentsTable.insertReturning {
                it[vpvId] = id
                it[platformParamId] = context.param(component, value.prop, adjustment)
                it[VariationPlatformParamAdjustmentsTable.value] = adjustment.value
                it[template] = adjustment.template
            }.single()
        }
    }

    private fun insertInvariantAdjustments(id: UUID, component: String, value: ValueSeed, context: SeedContext) {
        value.adjust.forEach { adjustment ->
            InvariantPlatformParamAdjustmentsTable.insertReturning {
                it[ipvId] = id
                it[platformParamId] = context.param(component, value.prop, adjustment)
                it[InvariantPlatformParamAdjustmentsTable.value] = adjustment.value
                it[template] = adjustment.template
            }.single()
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
