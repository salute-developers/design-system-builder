package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ComponentConfigRepository
import com.dsbuilder.ds.components.application.ImportComponentConfig
import com.dsbuilder.ds.components.domain.ComponentConfig
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Atomic importer preserving the legacy common-config semantics. */
internal class ComponentConfigImporter(private val builder: ComponentConfigBuilder = ComponentConfigBuilder()) {
    fun import(command: ImportComponentConfig): ComponentConfigRepository.ImportAttempt = runCatching {
        val context = createContext(command)
        command.components.forEach { importOne(command.designSystemId, it, context) }
        resolveReferences(command.designSystemId, context)
        journal(command, context)
        ComponentConfigRepository.ImportAttempt.Success(
            context.report.toDomain(context.paintTypes.mapValues { it.value.toSet() }),
        )
    }.getOrElse { ComponentConfigRepository.ImportAttempt.Failed(it.message ?: it.toString()) }

    private fun createContext(command: ImportComponentConfig) = ComponentConfigImportContext(
        ComponentTokensTable.selectAll().where { ComponentTokensTable.designSystemId eq command.designSystemId }
            .associate { it[ComponentTokensTable.name] to it[ComponentTokensTable.id] },
        command.components,
    ).also { context ->
        ComponentStatesTable.selectAll().where { ComponentStatesTable.componentId.isNull() }.forEach {
            context.interactionStates[it[ComponentStatesTable.name].canonical()] = it[ComponentStatesTable.id]
        }
        ComponentStateSetsTable.selectAll().forEach {
            context.stateSets[it[ComponentStateSetsTable.stateIds].distinct().sorted()] = it[ComponentStateSetsTable.id]
        }
    }

    private fun importOne(ds: UUID, entry: ImportComponentConfig.Entry, context: ComponentConfigImportContext) {
        invalidType(entry)?.let { return context.report.reject(entry, "Unsupported property type '$it'") }
        val component = component(entry.componentName, context) ?: return context.report.reject(
            entry,
            "Component '${entry.componentName}' is not present in the global layer",
        )
        val componentId = component[ComponentsTable.id]
        link(ds, componentId)
        loadStates(componentId, context)
        val old = appearance(ds, componentId, entry.styleName)
        val appearanceId = old?.get(ComponentAppearancesTable.id) ?: ComponentAppearancesTable.insertReturning {
            it[designSystemId] = ds
            it[ComponentAppearancesTable.componentId] = componentId
            it[name] = entry.styleName
            it[platform] = null
        }.single()[ComponentAppearancesTable.id]
        val descriptor = ConfigAppearance(
            appearanceId,
            ds,
            componentId,
            component[ComponentsTable.name],
            entry.styleName,
        )
        val before = old?.let { builder.build(descriptor, true, linkedSetOf()) }
        clear(appearanceId)
        val axes = upsertAxes(componentId, entry.config)
        val styles = upsertStyles(ds, entry.config, axes)
        declareAxes(appearanceId, entry.config, axes, styles)
        val properties = properties(componentId, entry, context)
        writeInvariants(ds, componentId, appearanceId, entry.config, properties, context)
        writeVariations(appearanceId, entry.config, axes, styles, properties, context)
        dependencies(componentId, entry.config, context)
        if (underivable(
                entry.config,
            )
        ) {
            context.report.underivableVariationIds += "${entry.componentName}.${entry.styleName}"
        }
        when {
            old == null -> context.report.created++
            before == builder.build(descriptor, true, linkedSetOf()) -> context.report.unchanged++
            else -> context.report.updated++
        }
    }

    private fun component(name: String, context: ComponentConfigImportContext): ResultRow? {
        val key = name.canonical()
        val id = context.componentIds[key]
        if (id != null) return ComponentsTable.selectAll().where { ComponentsTable.id eq id }.single()
        if (context.componentIds.containsKey(key)) return null
        return ComponentsTable.selectAll().firstOrNull { it[ComponentsTable.name].canonical() == key }.also {
            context.componentIds[key] = it?.get(ComponentsTable.id)
        }
    }

    private fun link(ds: UUID, component: UUID) {
        if (!DesignSystemComponentsTable.selectAll().where {
                (DesignSystemComponentsTable.designSystemId eq ds) and
                    (DesignSystemComponentsTable.componentId eq component)
            }.any()
        ) {
            DesignSystemComponentsTable.insertReturning {
                it[designSystemId] = ds
                it[componentId] = component
            }.single()
        }
    }

    private fun appearance(ds: UUID, component: UUID, name: String) = ComponentAppearancesTable.selectAll().where {
        (ComponentAppearancesTable.designSystemId eq ds) and
            (ComponentAppearancesTable.componentId eq component) and
            (ComponentAppearancesTable.name eq name) and ComponentAppearancesTable.platform.isNull()
    }.singleOrNull()

    private fun clear(id: UUID) {
        VariationPropertyValuesTable.deleteWhere { appearanceId eq id }
        InvariantPropertyValuesTable.deleteWhere { appearanceId eq id }
        StyleCombinationsTable.deleteWhere { appearanceId eq id }
        AppearanceCombinationsTable.deleteWhere { appearanceId eq id }
        AppearanceVariationsTable.deleteWhere { appearanceId eq id }
    }

    private fun upsertAxes(component: UUID, config: ComponentConfig) = axes(config).associate { (key, name) ->
        key to (
            VariationsTable.selectAll().where {
                (VariationsTable.componentId eq component) and (VariationsTable.name eq name)
            }.singleOrNull()?.get(VariationsTable.id) ?: VariationsTable.insertReturning {
                it[componentId] = component
                it[VariationsTable.name] = name
                it[description] = null
            }.single()[VariationsTable.id]
            )
    }

    private fun upsertStyles(ds: UUID, config: ComponentConfig, axes: Map<String, UUID>) =
        axisValues(config).associate { (axis, value) ->
            val variation = axes.getValue(axis)
            styleKey(axis, value) to (
                ComponentStylesTable.selectAll().where {
                    (ComponentStylesTable.designSystemId eq ds) and
                        (ComponentStylesTable.variationId eq variation) and (ComponentStylesTable.name eq value)
                }.singleOrNull()?.get(ComponentStylesTable.id) ?: ComponentStylesTable.insertReturning {
                    it[designSystemId] = ds
                    it[variationId] = variation
                    it[name] = value
                    it[description] = null
                }.single()[ComponentStylesTable.id]
                )
        }

    private fun declareAxes(id: UUID, config: ComponentConfig, axes: Map<String, UUID>, styles: Map<String, UUID>) {
        val values = axisValues(config).groupBy({ it.first }, { it.second })
        val defaults = config.defaults.associate { it.id to it.value.text() }
        axes(config).forEachIndexed { position, (axisId, _) ->
            val declared = config.variations.firstOrNull { it.id == axisId }
            val row = AppearanceVariationsTable.insertReturning {
                it[appearanceId] = id
                it[variationId] = axes.getValue(axisId)
                it[AppearanceVariationsTable.position] = position
                it[defaultStyleId] = defaults[axisId]?.let { value -> styles[styleKey(axisId, value)] }
                it[isColorScheme] = config.colorSchemeVariationId == axisId
                it[declaredType] = declared?.declaredType
            }.single()[AppearanceVariationsTable.id]
            val ordered = declared?.values?.map { it.name }.orEmpty() + values[axisId].orEmpty()
            ordered.distinct().forEachIndexed { valuePosition, value ->
                AppearanceVariationValuesTable.insertReturning {
                    it[appearanceVariationId] = row
                    it[styleId] = styles.getValue(styleKey(axisId, value))
                    it[AppearanceVariationValuesTable.position] = valuePosition
                    it[authoredId] = declared?.values?.firstOrNull {
                        it.name == value && it.targets.isNullOrEmpty()
                    }?.authoredId
                }.single()
            }
        }
    }

    private fun properties(component: UUID, entry: ImportComponentConfig.Entry, context: ComponentConfigImportContext) =
        propertyNames(entry.config).mapNotNull { name ->
            val row = PropertiesTable.selectAll().where { PropertiesTable.componentId eq component }
                .firstOrNull { it[PropertiesTable.name].canonical() == name.canonical() }
            if (row == null) {
                context.report.unknownProperties += name
                null
            } else {
                val global = row[PropertiesTable.type].wireValue
                val declared = propertyTypes(entry.config)[name].orEmpty()
                if (global in paintTypes) {
                    context.paintTypes.getOrPut("${entry.componentName}.$name") { linkedSetOf() }
                        .addAll(declared.filter(paintTypes::contains))
                }
                if (declared.isNotEmpty() && declared.none { compatible(global, it) }) {
                    val configTypes = declared.sorted().joinToString("/")
                    context.report.typeMismatches += "$name: global '$global', config '$configTypes'"
                }
                name to row[PropertiesTable.id]
            }
        }.toMap()

    private fun writeInvariants(
        ds: UUID,
        component: UUID,
        appearance: UUID,
        config: ComponentConfig,
        properties: Map<String, UUID>,
        context: ComponentConfigImportContext,
    ) = config.invariants.forEach { (name, property) ->
        val propertyId = properties[name] ?: return@forEach
        expand(property).forEach { value ->
            val states = stateSet(value.states, context) ?: return@forEach
            val id = InvariantPropertyValuesTable.insertReturning {
                it[InvariantPropertyValuesTable.propertyId] = propertyId
                it[designSystemId] = ds
                it[componentId] = component
                it[appearanceId] = appearance
                it[tokenId] = token(value.token, context)
                it[InvariantPropertyValuesTable.value] = value.value
                it[alpha] = value.alpha
                it[adjustment] = value.adjustment
                it[position] = value.position
                it[stateSetId] = states
            }.single()[InvariantPropertyValuesTable.id]
            reference(property, value, ComponentStyleSource.Invariant(id), context)
        }
    }

    @Suppress("NestedBlockDepth")
    private fun writeVariations(
        appearance: UUID,
        config: ComponentConfig,
        axes: Map<String, UUID>,
        styles: Map<String, UUID>,
        properties: Map<String, UUID>,
        context: ComponentConfigImportContext,
    ) {
        val declarations = linkedMapOf<String, Pair<List<UUID>, String?>>()
        config.variations.forEach { axis ->
            axis.values.forEach { value ->
                val own = styles.getValue(styleKey(axis.id, value.name))
                val targets = value.targets.orEmpty().flatMap { it.properties }
                    .mapNotNull { styles[styleKey(it.id, it.value.text())] }
                val members = (targets + own).distinct().sorted()
                if (targets.isNotEmpty()) declarations[members.joinToString()] = members to value.authoredId
                value.properties.forEach { (name, property) ->
                    val propertyId = properties[name] ?: return@forEach
                    linkProperty(propertyId, axes.getValue(axis.id))
                    expand(property).forEach { expanded ->
                        val states = stateSet(expanded.states, context) ?: return@forEach
                        if (targets.isEmpty()) {
                            direct(appearance, propertyId, own, property, expanded, states, context)
                        } else {
                            combination(appearance, propertyId, members, property, expanded, states, context)
                        }
                    }
                }
            }
        }
        declarations.values.forEachIndexed { position, (members, authored) ->
            val id = AppearanceCombinationsTable.insertReturning {
                it[appearanceId] = appearance
                it[combinationKey] = members.joinToString(",")
                it[AppearanceCombinationsTable.position] = position
                it[authoredId] = authored
            }.single()[AppearanceCombinationsTable.id]
            members.forEachIndexed { index, style ->
                AppearanceCombinationMembersTable.insertReturning {
                    it[appearanceCombinationId] = id
                    it[styleId] = style
                    it[AppearanceCombinationMembersTable.position] = index
                }.single()
            }
        }
    }

    private fun direct(
        a: UUID,
        p: UUID,
        s: UUID,
        property: ComponentConfig.Property,
        value: Expanded,
        states: UUID,
        c: ComponentConfigImportContext,
    ) {
        val id = VariationPropertyValuesTable.insertReturning {
            it[propertyId] = p
            it[styleId] = s
            it[appearanceId] = a
            it[tokenId] = token(value.token, c)
            it[VariationPropertyValuesTable.value] = value.value
            it[alpha] = value.alpha
            it[adjustment] = value.adjustment
            it[position] = value.position
            it[stateSetId] = states
        }.single()[VariationPropertyValuesTable.id]
        reference(property, value, ComponentStyleSource.Variation(id), c)
    }

    private fun combination(
        a: UUID,
        p: UUID,
        members: List<UUID>,
        property: ComponentConfig.Property,
        value: Expanded,
        states: UUID,
        c: ComponentConfigImportContext,
    ) {
        val id = StyleCombinationsTable.insertReturning {
            it[propertyId] = p
            it[appearanceId] = a
            it[combinationKey] = members.joinToString(",")
            it[StyleCombinationsTable.value] = value.value.orEmpty()
            it[tokenId] = token(value.token, c)
            it[alpha] = value.alpha
            it[adjustment] = value.adjustment
            it[position] = value.position
            it[stateSetId] = states
        }.single()[StyleCombinationsTable.id]
        members.forEach { style ->
            StyleCombinationMembersTable.insertReturning {
                it[combinationId] = id
                it[styleId] = style
            }.single()
        }
        reference(property, value, ComponentStyleSource.Combination(id), c)
    }

    private fun linkProperty(property: UUID, variation: UUID) {
        if (!PropertyVariationsTable.selectAll().where {
                (PropertyVariationsTable.propertyId eq property) and (PropertyVariationsTable.variationId eq variation)
            }.any()
        ) {
            PropertyVariationsTable.insertReturning {
                it[propertyId] = property
                it[variationId] = variation
            }.single()
        }
    }

    private fun stateSet(names: List<String>, context: ComponentConfigImportContext): UUID? {
        val ids = names.map { name ->
            context.interactionStates[name.canonical()] ?: context.componentStates[name.canonical()] ?: run {
                context.report.unknownStates += name
                return null
            }
        }.distinct().sorted()
        return context.stateSets[ids] ?: ComponentStateSetsTable.insertReturning {
            it[stateIds] = ids
            it[ownerComponentId] = null
        }
            .single()[ComponentStateSetsTable.id].also { context.stateSets[ids] = it }
    }

    private fun loadStates(component: UUID, context: ComponentConfigImportContext) {
        context.componentStates.clear()
        ComponentStatesTable.selectAll().where { ComponentStatesTable.componentId eq component }.forEach {
            context.componentStates[it[ComponentStatesTable.name].canonical()] = it[ComponentStatesTable.id]
        }
    }

    private fun reference(
        property: ComponentConfig.Property,
        value: Expanded,
        source: ComponentStyleSource,
        context: ComponentConfigImportContext,
    ) {
        if (property.type == componentStyle && value.states.isEmpty() && value.value != null) {
            context.pendingReferences += PendingComponentStyleReference(value.value, source)
        }
    }

    private fun resolveReferences(ds: UUID, context: ComponentConfigImportContext) =
        context.pendingReferences.forEach { pending ->
            val parts = pending.reference.split('.')
            val styleName = parts.first()
            val componentName = context.styleToComponent[styleName] ?: styleName
            val component = component(componentName, context)?.get(ComponentsTable.id)
            val target = component?.let { appearance(ds, it, styleName) }
            val available = component?.let { componentId ->
                ComponentStylesTable.innerJoin(VariationsTable).selectAll().where {
                    (ComponentStylesTable.designSystemId eq ds) and (VariationsTable.componentId eq componentId)
                }.associate { it[ComponentStylesTable.name] to it[ComponentStylesTable.id] }
            }.orEmpty()
            val targetStyles = parts.drop(1).mapNotNull(available::get)
            if (target == null || targetStyles.size != parts.size - 1) {
                context.report.unresolvedComponentStyles += pending.reference
            } else {
                val id = ComponentStyleReferencesTable.insertReturning {
                    it[designSystemId] = ds
                    it[invariantPropertyValueId] = (pending.source as? ComponentStyleSource.Invariant)?.id
                    it[variationPropertyValueId] = (pending.source as? ComponentStyleSource.Variation)?.id
                    it[styleCombinationId] = (pending.source as? ComponentStyleSource.Combination)?.id
                    it[targetAppearanceId] = target[ComponentAppearancesTable.id]
                    it[reference] = pending.reference
                }.single()[ComponentStyleReferencesTable.id]
                targetStyles.distinct().forEach { style ->
                    ComponentStyleReferenceStylesTable.insertReturning {
                        it[referenceId] = id
                        it[styleId] = style
                    }.single()
                }
            }
        }

    private fun dependencies(
        component: UUID,
        config: ComponentConfig,
        context: ComponentConfigImportContext,
    ) = allProperties(config)
        .filter { it.type == componentStyle }.mapNotNull { it.value.raw() }.forEach { value ->
            val name = value.substringBefore('.')
            val child = component(context.styleToComponent[name] ?: name, context)?.get(ComponentsTable.id)
            if (child == null) {
                context.report.unresolvedComponentStyles += value
            } else if (child != component && !ComponentDependenciesTable.selectAll().where {
                    (ComponentDependenciesTable.parentId eq component) and
                        (ComponentDependenciesTable.childId eq child) and
                        (ComponentDependenciesTable.type eq RelationTypeDb.REUSE)
                }.any()
            ) {
                ComponentDependenciesTable.insertReturning {
                    it[parentId] = component
                    it[childId] = child
                    it[type] = RelationTypeDb.REUSE
                    it[order] = null
                }.single()
            }
        }

    private fun journal(command: ImportComponentConfig, context: ComponentConfigImportContext) {
        DesignSystemChangesTable.insertReturning {
            it[designSystemId] = command.designSystemId
            it[entityType] = "components:import"
            it[entityId] = command.designSystemId
            it[operation] = if (context.report.created > 0) {
                ComponentChangeOperationDb.CREATED
            } else {
                ComponentChangeOperationDb.UPDATED
            }
            it[data] = buildJsonObject {
                put(
                    "meta",
                    buildJsonObject {
                        put("name", command.meta.name)
                        put("source", command.meta.source)
                    },
                )
                put("dryRun", command.dryRun)
                put("created", context.report.created)
                put("updated", context.report.updated)
                put("unchanged", context.report.unchanged)
                put(
                    "rejected",
                    buildJsonArray {
                        context.report.rejected.forEach { rejection ->
                            add(
                                buildJsonObject {
                                    put("componentName", rejection.componentName)
                                    put("styleName", rejection.styleName)
                                    put("reason", rejection.reason)
                                },
                            )
                        }
                    },
                )
            }
        }.single()
    }

    private fun token(name: String?, context: ComponentConfigImportContext): UUID? = name?.let {
        context.tokens[it] ?: run {
            context.report.unresolvedTokens += it
            null
        }
    }
    private fun invalidType(entry: ImportComponentConfig.Entry) = allProperties(entry.config)
        .flatMap { listOf(it.type) + it.states.mapNotNull(ComponentConfig.State::type) }
        .firstOrNull { it !in valueTypes }
    private fun axes(config: ComponentConfig): List<Pair<String, String>> = buildList {
        addAll(config.variations.map { it.id to it.name })
        config.variations.flatMap { it.values }.flatMap { it.targets.orEmpty() }.flatMap { it.properties }
            .forEach { if (none { axis -> axis.first == it.id }) add(it.id to it.id) }
    }
    private fun axisValues(config: ComponentConfig) = buildList {
        config.defaults.filter { it.value is ComponentConfig.Scalar.BooleanValue }.forEach {
            add(
                it.id to it.value.text(),
            )
        }
        config.variations.forEach { axis ->
            axis.values.forEach { value ->
                add(axis.id to value.name)
                value.targets.orEmpty().flatMap { it.properties }.forEach { add(it.id to it.value.text()) }
            }
        }
    }.distinct()
    private fun propertyNames(
        config: ComponentConfig,
    ) = config.invariants.keys + config.variations.flatMap { it.values }.flatMap { it.properties.keys }
    private fun propertyTypes(
        config: ComponentConfig,
    ): Map<String, Set<String>> = buildMap<String, MutableSet<String>> {
        fun add(
            name: String,
            p: ComponentConfig.Property,
        ) {
            getOrPut(name) { linkedSetOf() }.apply {
                add(p.type)
                addAll(p.states.mapNotNull { it.type })
            }
        }
        config.invariants.forEach(::add)
        config.variations.flatMap { it.values }.forEach { it.properties.forEach(::add) }
    }
    private fun allProperties(
        config: ComponentConfig,
    ) = config.invariants.values +
        config.variations.flatMap { it.values }.flatMap { it.properties.values }
    private fun underivable(
        config: ComponentConfig,
    ) = config.variations.any { axis ->
        axis.id != config.colorSchemeVariationId && axis.values.any { value ->
            value.authoredId?.let {
                val coordinates = value.targets.orEmpty().flatMap { target -> target.properties }
                    .map { property -> property.value.text() } + value.name
                it != coordinates.joinToString(".")
            } == true
        }
    }
    private fun expand(
        p: ComponentConfig.Property,
    ) = listOf(
        Expanded(
            p.value.raw(),
            tokenName(p.type, p.value),
            p.alpha?.raw(),
            p.adjustment?.raw(),
            emptyList(),
            0,
        ),
    ) +
        p.states.mapIndexedNotNull { index, state ->
            state.state.sorted().takeIf { it.isNotEmpty() }?.let {
                Expanded(
                    state.value.raw(),
                    tokenName(state.type ?: p.type, state.value),
                    state.alpha?.raw(),
                    null,
                    it,
                    index + 1,
                )
            }
        }
    private fun tokenName(
        type: String,
        value: ComponentConfig.Scalar,
    ) = (value as? ComponentConfig.Scalar.Text)?.value
        ?.takeIf { type in tokenTypes && it.isNotEmpty() }
    private fun compatible(
        a: String,
        b: String,
    ) = a == b || (a in numericTypes && b in numericTypes) || (a in paintTypes && b in paintTypes)
    private data class Expanded(
        val value: String?,
        val token: String?,
        val alpha: String?,
        val adjustment: String?,
        val states: List<String>,
        val position: Int,
    )
    private companion object {
        const val componentStyle = "component_style"
        val valueTypes =
            setOf(
                "color", "gradient", "typography", "shape", "shadow", "dimension", "float", "integer",
                "boolean", "icon", componentStyle, "value",
            )
        val tokenTypes = setOf("color", "gradient", "typography", "shape", "shadow")
        val numericTypes = setOf("integer", "float", "dimension", "value")
        val paintTypes = setOf("color", "gradient")
    }
}

private fun styleKey(axis: String, value: String) = "$axis\u0000$value"
private fun String.canonical() = lowercase().filter(Char::isLetterOrDigit)
private fun ComponentConfig.Scalar.text() = when (this) {
    is ComponentConfig.Scalar.Text -> value
    is ComponentConfig.Scalar.Number -> value
    is ComponentConfig.Scalar.BooleanValue -> value.toString()
    ComponentConfig.Scalar.Null -> "null"
    else -> raw().orEmpty()
}
private fun ComponentConfig.Scalar.raw(): String? = when (this) {
    is ComponentConfig.Scalar.Text -> value
    is ComponentConfig.Scalar.Number -> value
    is ComponentConfig.Scalar.BooleanValue -> value.toString()
    ComponentConfig.Scalar.Null -> null
    is ComponentConfig.Scalar.ArrayValue -> value.joinToString(prefix = "[", postfix = "]") { it.json() }
    is ComponentConfig.Scalar.ObjectValue -> value.entries.joinToString(prefix = "{", postfix = "}") {
        "${JsonPrimitive(it.key)}:${it.value.json()}"
    }
}
private fun ComponentConfig.Scalar.json() = if (this is ComponentConfig.Scalar.Text) {
    JsonPrimitive(
        value,
    ).toString()
} else {
    raw().orEmpty()
}
