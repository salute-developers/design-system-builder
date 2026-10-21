package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ComponentConfigRepository
import com.dsbuilder.ds.components.application.ImportComponentConfig
import com.dsbuilder.ds.components.domain.ComponentConfig
import com.dsbuilder.ds.components.domain.RootCandidate
import com.dsbuilder.ds.components.domain.fallbackRoot
import kotlinx.serialization.json.JsonPrimitive
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Atomic importer preserving the legacy common-config semantics. */
internal class ComponentConfigImporter(private val builder: ComponentConfigBuilder = ComponentConfigBuilder()) {
    fun import(command: ImportComponentConfig): ComponentConfigRepository.ImportAttempt = runCatching {
        // Как при прежней последовательной замене, последняя запись одного appearance побеждает.
        // Согласовываем её сразу, чтобы предыдущая запись не удерживала удалённые дочерние элементы.
        val entries = command.components.associateBy { it.componentName.canonical() to it.styleName }.values.toList()
        val context = createContext(command.copy(components = entries))
        entries.forEach { importOne(command.designSystemId, it, context) }
        resolveReferences(command.designSystemId, context)
        context.appearances.forEach { clear(it, context.sync) }
        context.completed.forEach { it() }
        ComponentConfigRepository.ImportAttempt.Success(
            context.report.toDomain(context.paintTypes.mapValues { it.value.toSet() }),
        )
    }.getOrElse { ComponentConfigRepository.ImportAttempt.Failed(it.message ?: it.toString()) }

    private fun createContext(command: ImportComponentConfig) = ComponentConfigImportContext(
        ComponentTokensTable.selectAll().where { ComponentTokensTable.designSystemId eq command.designSystemId }
            .associate { it[ComponentTokensTable.name] to it[ComponentTokensTable.id] },
        command.components,
        requireNotNull(ComponentPlatformDb.fromWire(command.platform)),
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
        unknownRoot(entry.config)?.let {
            return context.report.reject(entry, "rootVariationId '$it' names no axis of the configuration")
        }
        val component = component(entry.componentName, context) ?: return context.report.reject(
            entry,
            "Component '${entry.componentName}' is not present in the global layer for platform " +
                "'${context.platform.wireValue}'",
        )
        val componentId = component[ComponentsTable.id]
        link(ds, componentId)
        loadStates(componentId, context)
        val old = appearance(ds, componentId, entry.styleName)
        val appearanceId = old?.get(ComponentAppearancesTable.id) ?: run {
            val id = StableAppearancesTable.insertReturning {
                it[designSystemId] = ds
                it[StableAppearancesTable.componentId] = componentId
            }.single()[StableAppearancesTable.id]
            val first = isFirstAppearanceOfComponent(ds, componentId, id)
            AppearanceRevisionsTable.replaceRevision(AppearanceRevisionsTable.entityId, id, ds) { statement ->
                statement[name] = entry.styleName
                statement[rootVariationId] = null
                statement[colorSchemeVariationId] = null
                statement[isDefault] = first
            }
            id
        }
        val descriptor = ConfigAppearance(
            appearanceId,
            ds,
            componentId,
            component[ComponentsTable.name],
            entry.styleName,
        )
        val before = old?.let { builder.build(descriptor, true, linkedSetOf()) }
        context.appearances += appearanceId
        val names = if (old != null) EffectiveNameSnapshot.capture(appearanceId) else EffectiveNameSnapshot.EMPTY
        val axes = upsertAxes(componentId, entry.config, names)
        val styles = upsertStyles(ds, entry.config, axes, names)
        declareAxes(appearanceId, entry.config, axes, styles, names, context)
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
        context.completed += {
            when {
                old == null -> context.report.created++
                before == builder.build(descriptor, true, linkedSetOf()) -> context.report.unchanged++
                else -> context.report.updated++
            }
        }
    }

    private fun component(name: String, context: ComponentConfigImportContext): ResultRow? {
        val key = name.canonical()
        val id = context.componentIds[key]
        if (id != null) return ComponentsTable.selectAll().where { ComponentsTable.id eq id }.single()
        if (context.componentIds.containsKey(key)) return null
        return ComponentsTable.selectAll().where { ComponentsTable.platform eq context.platform }
            .firstOrNull { it[ComponentsTable.name].canonical() == key }.also {
                context.componentIds[key] = it?.get(ComponentsTable.id)
            }
    }

    private fun link(ds: UUID, component: UUID) {
        if (!DesignSystemComponentsTable.selectAll().where {
                (DesignSystemComponentsTable.designSystemId eq ds) and
                    (DesignSystemComponentsTable.componentId eq component)
            }.any()
        ) {
            val id = StableDesignSystemComponentsTable.insertReturning {
                it[designSystemId] = ds
                it[componentId] = component
            }.single()[StableDesignSystemComponentsTable.id]
            DesignSystemComponentRevisionsTable.replaceRevision(
                DesignSystemComponentRevisionsTable.entityId,
                id,
                ds,
            )
        }
    }

    private fun appearance(ds: UUID, component: UUID, name: String) = ComponentAppearancesTable.selectAll().where {
        (ComponentAppearancesTable.designSystemId eq ds) and
            (ComponentAppearancesTable.componentId eq component) and
            (ComponentAppearancesTable.name eq name)
    }.singleOrNull()

    @Suppress("CyclomaticComplexMethod", "LongMethod")
    private fun clear(id: UUID, sync: ComponentConfigImportSync) {
        val ds = StableAppearancesTable.selectAll().where { StableAppearancesTable.id eq id }
            .single()[StableAppearancesTable.designSystemId]

        val variationValues = VariationPropertyValuesTable.selectAll().where {
            VariationPropertyValuesTable.appearanceId eq id
        }.map { it[VariationPropertyValuesTable.id] }
        val invariantValues = InvariantPropertyValuesTable.selectAll().where {
            InvariantPropertyValuesTable.appearanceId eq id
        }.map { it[InvariantPropertyValuesTable.id] }
        val styleCombinations = StyleCombinationsTable.selectAll().where {
            StyleCombinationsTable.appearanceId eq id
        }.map { it[StyleCombinationsTable.id] }
        val references = if (variationValues.isEmpty() && invariantValues.isEmpty() && styleCombinations.isEmpty()) {
            emptyList()
        } else {
            ComponentStyleReferencesTable.selectAll().where {
                var predicate: Op<Boolean> = Op.FALSE
                if (variationValues.isNotEmpty()) {
                    predicate = predicate or
                        (ComponentStyleReferencesTable.variationPropertyValueId inList variationValues)
                }
                if (invariantValues.isNotEmpty()) {
                    predicate = predicate or
                        (ComponentStyleReferencesTable.invariantPropertyValueId inList invariantValues)
                }
                if (styleCombinations.isNotEmpty()) {
                    predicate = predicate or
                        (ComponentStyleReferencesTable.styleCombinationId inList styleCombinations)
                }
                predicate
            }.toList()
        }
        if (references.isNotEmpty()) {
            val referenceIds = references.map { it[ComponentStyleReferencesTable.id] }
            ComponentStyleReferenceStylesTable.selectAll().where {
                ComponentStyleReferenceStylesTable.referenceId inList referenceIds
            }.forEach { row ->
                sync.remove(
                    ComponentStyleReferenceStyleRevisionsTable,
                    ComponentStyleReferenceStyleRevisionsTable.entityId,
                    row[ComponentStyleReferenceStylesTable.id],
                    ds,
                )
            }
            references.forEach { reference ->
                sync.remove(
                    ComponentStyleReferenceRevisionsTable,
                    ComponentStyleReferenceRevisionsTable.entityId,
                    reference[ComponentStyleReferencesTable.id],
                    ds,
                ) { statement ->
                    statement[invariantPropertyValueId] =
                        reference[ComponentStyleReferencesTable.invariantPropertyValueId]
                    statement[variationPropertyValueId] =
                        reference[ComponentStyleReferencesTable.variationPropertyValueId]
                    statement[styleCombinationId] = reference[ComponentStyleReferencesTable.styleCombinationId]
                }
            }
        }

        if (variationValues.isNotEmpty()) {
            VariationPlatformParamAdjustmentsTable.selectAll().where {
                VariationPlatformParamAdjustmentsTable.vpvId inList variationValues
            }.forEach { row ->
                if (sync.retained(
                        VariationPropertyValueRevisionsTable,
                        row[VariationPlatformParamAdjustmentsTable.vpvId],
                    )
                ) {
                    return@forEach
                }
                sync.remove(
                    VariationPlatformParamAdjustmentRevisionsTable,
                    VariationPlatformParamAdjustmentRevisionsTable.entityId,
                    row[VariationPlatformParamAdjustmentsTable.id],
                    ds,
                )
            }
        }
        if (invariantValues.isNotEmpty()) {
            InvariantPlatformParamAdjustmentsTable.selectAll().where {
                InvariantPlatformParamAdjustmentsTable.ipvId inList invariantValues
            }.forEach { row ->
                if (sync.retained(
                        InvariantPropertyValueRevisionsTable,
                        row[InvariantPlatformParamAdjustmentsTable.ipvId],
                    )
                ) {
                    return@forEach
                }
                sync.remove(
                    InvariantPlatformParamAdjustmentRevisionsTable,
                    InvariantPlatformParamAdjustmentRevisionsTable.entityId,
                    row[InvariantPlatformParamAdjustmentsTable.id],
                    ds,
                )
            }
        }
        variationValues.forEach { valueId ->
            sync.remove(
                VariationPropertyValueRevisionsTable,
                VariationPropertyValueRevisionsTable.entityId,
                valueId,
                ds,
            )
        }
        invariantValues.forEach { valueId ->
            sync.remove(
                InvariantPropertyValueRevisionsTable,
                InvariantPropertyValueRevisionsTable.entityId,
                valueId,
                ds,
            )
        }
        val styleMembers = if (styleCombinations.isEmpty()) {
            emptyMap()
        } else {
            StyleCombinationMembersTable.selectAll().where {
                StyleCombinationMembersTable.combinationId inList styleCombinations
            }.groupBy { it[StyleCombinationMembersTable.combinationId] }
        }
        styleCombinations.forEach { combinationId ->
            styleMembers[combinationId].orEmpty().forEach { row ->
                sync.remove(
                    StyleCombinationMemberRevisionsTable,
                    StyleCombinationMemberRevisionsTable.entityId,
                    row[StyleCombinationMembersTable.id],
                    ds,
                )
            }
            sync.remove(StyleCombinationRevisionsTable, StyleCombinationRevisionsTable.entityId, combinationId, ds)
        }
        val appearanceCombinations = AppearanceCombinationsTable.selectAll()
            .where { AppearanceCombinationsTable.appearanceId eq id }.toList()
        val appearanceCombinationIds = appearanceCombinations.map { it[AppearanceCombinationsTable.id] }
        val appearanceMembers = if (appearanceCombinationIds.isEmpty()) {
            emptyMap()
        } else {
            AppearanceCombinationMembersTable.selectAll().where {
                AppearanceCombinationMembersTable.appearanceCombinationId inList appearanceCombinationIds
            }.groupBy { it[AppearanceCombinationMembersTable.appearanceCombinationId] }
        }
        appearanceCombinations.forEach { combination ->
            val combinationId = combination[AppearanceCombinationsTable.id]
            appearanceMembers[combinationId].orEmpty().forEach { member ->
                sync.remove(
                    AppearanceCombinationMemberRevisionsTable,
                    AppearanceCombinationMemberRevisionsTable.entityId,
                    member[AppearanceCombinationMembersTable.id],
                    ds,
                )
            }
            sync.remove(
                AppearanceCombinationRevisionsTable,
                AppearanceCombinationRevisionsTable.entityId,
                combinationId,
                ds,
            )
        }
        val appearanceVariations = AppearanceVariationsTable.selectAll()
            .where { AppearanceVariationsTable.appearanceId eq id }.toList()
        val appearanceVariationIds = appearanceVariations.map { it[AppearanceVariationsTable.id] }
        val appearanceValues = if (appearanceVariationIds.isEmpty()) {
            emptyMap()
        } else {
            AppearanceVariationValuesTable.selectAll().where {
                AppearanceVariationValuesTable.appearanceVariationId inList appearanceVariationIds
            }.groupBy { it[AppearanceVariationValuesTable.appearanceVariationId] }
        }
        appearanceVariations.forEach { axis ->
            val axisId = axis[AppearanceVariationsTable.id]
            appearanceValues[axisId].orEmpty().forEach { value ->
                sync.remove(
                    AppearanceVariationValueRevisionsTable,
                    AppearanceVariationValueRevisionsTable.entityId,
                    value[AppearanceVariationValuesTable.id],
                    ds,
                )
            }
            sync.remove(AppearanceVariationRevisionsTable, AppearanceVariationRevisionsTable.entityId, axisId, ds)
        }
    }

    private fun upsertAxes(
        component: UUID,
        config: ComponentConfig,
        names: EffectiveNameSnapshot,
    ) = axes(config).associate { (key, name) ->
        key to (
            names.axis(name)?.variationId ?: VariationsTable.selectAll().where {
                (VariationsTable.componentId eq component) and (VariationsTable.name eq name)
            }.singleOrNull()?.get(VariationsTable.id) ?: VariationsTable.insertReturning {
                it[componentId] = component
                it[VariationsTable.name] = name
                it[description] = null
            }.single()[VariationsTable.id]
            )
    }

    private fun upsertStyles(
        ds: UUID,
        config: ComponentConfig,
        axes: Map<String, UUID>,
        names: EffectiveNameSnapshot,
    ) =
        axisValues(config).associate { (axis, value) ->
            val variation = axes.getValue(axis)
            styleKey(axis, value) to (
                names.value(variation, value)?.styleId ?: ComponentStylesTable.selectAll().where {
                    (ComponentStylesTable.designSystemId eq ds) and
                        (ComponentStylesTable.variationId eq variation) and (ComponentStylesTable.name eq value)
                }.singleOrNull()?.get(ComponentStylesTable.id) ?: run {
                    val id = StableStylesTable.insertReturning {
                        it[designSystemId] = ds
                        it[variationId] = variation
                    }.single()[StableStylesTable.id]
                    StyleRevisionsTable.replaceRevision(StyleRevisionsTable.entityId, id, ds) { statement ->
                        statement[name] = value
                        statement[description] = null
                    }
                    id
                }
                )
        }

    private fun declareAxes(
        id: UUID,
        config: ComponentConfig,
        axes: Map<String, UUID>,
        styles: Map<String, UUID>,
        names: EffectiveNameSnapshot,
        context: ComponentConfigImportContext,
    ) {
        val values = axisValues(config).groupBy({ it.first }, { it.second })
        val defaults = config.defaults.associate { it.id to it.value.text() }
        axes(config).forEachIndexed { position, (axisId, axisName) ->
            val declared = config.variations.firstOrNull { it.id == axisId }
            val existing = StableAppearanceVariationsTable.selectAll().where {
                (StableAppearanceVariationsTable.appearanceId eq id) and
                    (StableAppearanceVariationsTable.variationId eq axes.getValue(axisId))
            }.singleOrNull()?.get(StableAppearanceVariationsTable.id)
            val row = existing ?: StableAppearanceVariationsTable.insertReturning {
                it[appearanceId] = id
                it[variationId] = axes.getValue(axisId)
                it[designSystemId] = StableAppearancesTable.selectAll()
                    .where { StableAppearancesTable.id eq id }.single()[StableAppearancesTable.designSystemId]
            }.single()[StableAppearanceVariationsTable.id]
            val ds = StableAppearanceVariationsTable.selectAll().where { StableAppearanceVariationsTable.id eq row }
                .single()[StableAppearanceVariationsTable.designSystemId]
            context.sync.write(
                AppearanceVariationRevisionsTable,
                AppearanceVariationsTable,
                AppearanceVariationRevisionsTable.entityId,
                row,
                ds,
            ) { statement ->
                statement[AppearanceVariationRevisionsTable.position] = position
                statement[defaultStyleId] = defaults[axisId]?.let { value -> styles[styleKey(axisId, value)] }
                statement[declaredType] = declared?.declaredType
                statement[AppearanceVariationRevisionsTable.displayName] =
                    names.axis(axisName)?.takeIf { it.variationId == axes.getValue(axisId) }?.displayName
            }
            val ordered = declared?.values?.map { it.name }.orEmpty() + values[axisId].orEmpty()
            ordered.distinct().forEachIndexed { valuePosition, value ->
                val style = styles.getValue(styleKey(axisId, value))
                val valueId = context.sync.id(
                    AppearanceVariationValuesTable, AppearanceVariationValuesTable.id,
                    AppearanceVariationValuesTable.appearanceVariationId to row,
                    AppearanceVariationValuesTable.styleId to style,
                ) ?: StableAppearanceVariationValuesTable.insertReturning {
                    it[appearanceVariationId] = row
                    it[designSystemId] = ds
                }.single()[StableAppearanceVariationValuesTable.id]
                context.sync.write(
                    AppearanceVariationValueRevisionsTable,
                    AppearanceVariationValuesTable,
                    AppearanceVariationValueRevisionsTable.entityId,
                    valueId,
                    ds,
                ) { statement ->
                    statement[styleId] = style
                    statement[AppearanceVariationValueRevisionsTable.position] = valuePosition
                    statement[authoredId] = declared?.values?.firstOrNull {
                        it.name == value && it.targets.isNullOrEmpty()
                    }?.authoredId
                    statement[AppearanceVariationValueRevisionsTable.displayName] =
                        names.value(axes.getValue(axisId), value)?.displayName
                }
            }
        }
        storeRoles(id, config, axes)
    }

    /** Сохраняет роли осей; корень, не указанный в конфигурации, выбирается по правилу фолбэка. */
    private fun storeRoles(id: UUID, config: ComponentConfig, axes: Map<String, UUID>) {
        val colorScheme = config.colorSchemeVariationId?.let(axes::get)
        val root = config.rootVariationId?.let(axes::get) ?: fallbackRoot(
            axes(config).mapIndexed { position, (key, name) -> RootCandidate(axes.getValue(key), name, position) },
            colorScheme,
        )
        val current = AppearanceAxisRoleStore.load(listOf(id)).getValue(id)
        if (current.root != root || current.colorScheme != colorScheme) {
            AppearanceAxisRoleStore.store(id, root, colorScheme)
        }
    }

    /** Возвращает указанный в конфигурации корень, если он не совпадает ни с одной осью. */
    private fun unknownRoot(config: ComponentConfig): String? =
        config.rootVariationId?.takeIf { root -> axes(config).none { it.first == root } }

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
            val id = context.sync.id(
                InvariantPropertyValuesTable, InvariantPropertyValuesTable.id,
                InvariantPropertyValuesTable.appearanceId to appearance,
                InvariantPropertyValuesTable.propertyId to propertyId,
                InvariantPropertyValuesTable.stateSetId to states,
            ) ?: StableInvariantPropertyValuesTable.insertReturning {
                it[StableInvariantPropertyValuesTable.propertyId] = propertyId
                it[designSystemId] = ds
                it[componentId] = component
                it[appearanceId] = appearance
            }.single()[StableInvariantPropertyValuesTable.id]
            context.sync.write(
                InvariantPropertyValueRevisionsTable,
                InvariantPropertyValuesTable,
                InvariantPropertyValueRevisionsTable.entityId,
                id,
                ds,
            ) { statement ->
                val token = token(value.token, context)
                statement[tokenId] = token
                statement[InvariantPropertyValueRevisionsTable.value] = value.value.takeIf { token == null }
                statement[alpha] = value.alpha
                statement[adjustment] = value.adjustment
                statement[position] = value.position
                statement[stateSetId] = states
            }
            reference(property, value, ComponentStyleSource.Invariant(id), context)
        }
    }

    @Suppress("LongMethod", "NestedBlockDepth")
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
        // Declared coordinates are stored in a canonical order (axis, then value, in the order of the axes), not in
        // the order of the entries in the file, so a config and its own export produce the same stored state.
        val rank = canonicalRank(config, styles)
        val unranked = Int.MAX_VALUE to Int.MAX_VALUE
        fun ranks(members: List<UUID>) = members.map { rank[it] ?: unranked }.sortedWith(RANK)
        val ordered = declarations.values.sortedWith { left, right ->
            compareRanks(ranks(left.first), ranks(right.first))
        }
        ordered.forEachIndexed { position, (members, authored) ->
            val ds = StableAppearancesTable.selectAll().where { StableAppearancesTable.id eq appearance }
                .single()[StableAppearancesTable.designSystemId]
            val key = members.joinToString(",")
            val id = context.sync.id(
                AppearanceCombinationsTable, AppearanceCombinationsTable.id,
                AppearanceCombinationsTable.appearanceId to appearance,
                AppearanceCombinationsTable.combinationKey to key,
            ) ?: StableAppearanceCombinationsTable.insertReturning {
                it[appearanceId] = appearance
                it[designSystemId] = ds
            }.single()[StableAppearanceCombinationsTable.id]
            context.sync.write(
                AppearanceCombinationRevisionsTable,
                AppearanceCombinationsTable,
                AppearanceCombinationRevisionsTable.entityId,
                id,
                ds,
            ) { statement ->
                statement[combinationKey] = key
                statement[AppearanceCombinationRevisionsTable.position] = position
                statement[authoredId] = authored
            }
            members.forEachIndexed { index, style ->
                val memberId = context.sync.id(
                    AppearanceCombinationMembersTable, AppearanceCombinationMembersTable.id,
                    AppearanceCombinationMembersTable.appearanceCombinationId to id,
                    AppearanceCombinationMembersTable.styleId to style,
                ) ?: StableAppearanceCombinationMembersTable.insertReturning {
                    it[appearanceCombinationId] = id
                    it[designSystemId] = ds
                }.single()[StableAppearanceCombinationMembersTable.id]
                context.sync.write(
                    AppearanceCombinationMemberRevisionsTable,
                    AppearanceCombinationMembersTable,
                    AppearanceCombinationMemberRevisionsTable.entityId,
                    memberId,
                    ds,
                ) { statement ->
                    statement[styleId] = style
                    statement[AppearanceCombinationMemberRevisionsTable.position] = index
                }
            }
        }
    }

    /** Position of every style as (axis index, value index), the same positions that [declareAxes] stores. */
    private fun canonicalRank(config: ComponentConfig, styles: Map<String, UUID>): Map<UUID, Pair<Int, Int>> {
        val values = axisValues(config).groupBy({ it.first }, { it.second })
        return buildMap {
            axes(config).forEachIndexed { axisIndex, (axisId, _) ->
                val declared = config.variations.firstOrNull { it.id == axisId }?.values?.map { it.name }.orEmpty()
                (declared + values[axisId].orEmpty()).distinct().forEachIndexed { valueIndex, value ->
                    styles[styleKey(axisId, value)]?.let { put(it, axisIndex to valueIndex) }
                }
            }
        }
    }

    private fun compareRanks(left: List<Pair<Int, Int>>, right: List<Pair<Int, Int>>): Int {
        left.zip(right).forEach { (l, r) -> RANK.compare(l, r).takeIf { it != 0 }?.let { return it } }
        return left.size.compareTo(right.size)
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
        val ds = StableAppearancesTable.selectAll().where { StableAppearancesTable.id eq a }
            .single()[StableAppearancesTable.designSystemId]
        val id = c.sync.id(
            VariationPropertyValuesTable, VariationPropertyValuesTable.id,
            VariationPropertyValuesTable.appearanceId to a,
            VariationPropertyValuesTable.propertyId to p,
            VariationPropertyValuesTable.styleId to s,
            VariationPropertyValuesTable.stateSetId to states,
        ) ?: StableVariationPropertyValuesTable.insertReturning {
            it[propertyId] = p
            it[styleId] = s
            it[appearanceId] = a
            it[designSystemId] = ds
        }.single()[StableVariationPropertyValuesTable.id]
        c.sync.write(
            VariationPropertyValueRevisionsTable,
            VariationPropertyValuesTable,
            VariationPropertyValueRevisionsTable.entityId,
            id,
            ds,
        ) { statement ->
            val token = token(value.token, c)
            statement[tokenId] = token
            statement[VariationPropertyValueRevisionsTable.value] = value.value.takeIf { token == null }
            statement[alpha] = value.alpha
            statement[adjustment] = value.adjustment
            statement[position] = value.position
            statement[stateSetId] = states
        }
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
        val ds = StableAppearancesTable.selectAll().where { StableAppearancesTable.id eq a }
            .single()[StableAppearancesTable.designSystemId]
        val key = members.joinToString(",")
        val id = c.sync.id(
            StyleCombinationsTable, StyleCombinationsTable.id,
            StyleCombinationsTable.appearanceId to a,
            StyleCombinationsTable.propertyId to p,
            StyleCombinationsTable.combinationKey to key,
            StyleCombinationsTable.stateSetId to states,
        ) ?: StableStyleCombinationsTable.insertReturning {
            it[propertyId] = p
            it[appearanceId] = a
            it[designSystemId] = ds
        }.single()[StableStyleCombinationsTable.id]
        c.sync.write(
            StyleCombinationRevisionsTable,
            StyleCombinationsTable,
            StyleCombinationRevisionsTable.entityId,
            id,
            ds,
        ) { statement ->
            statement[combinationKey] = key
            statement[StyleCombinationRevisionsTable.value] = value.value.orEmpty()
            statement[tokenId] = token(value.token, c)
            statement[alpha] = value.alpha
            statement[adjustment] = value.adjustment
            statement[position] = value.position
            statement[stateSetId] = states
        }
        members.forEach { style ->
            val memberId = c.sync.id(
                StyleCombinationMembersTable, StyleCombinationMembersTable.id,
                StyleCombinationMembersTable.combinationId to id,
                StyleCombinationMembersTable.styleId to style,
            ) ?: StableStyleCombinationMembersTable.insertReturning {
                it[combinationId] = id
                it[designSystemId] = ds
            }.single()[StableStyleCombinationMembersTable.id]
            c.sync.write(
                StyleCombinationMemberRevisionsTable,
                StyleCombinationMembersTable,
                StyleCombinationMemberRevisionsTable.entityId,
                memberId,
                ds,
            ) { statement -> statement[styleId] = style }
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
        if (property.type == componentStyle && value.value != null) {
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
            val available = component?.let { referenceStyles(ds, it) }.orEmpty()
            val targetStyles = parts.drop(1).mapNotNull(available::get)
            if (target == null || targetStyles.size != parts.size - 1) {
                context.report.unresolvedComponentStyles += pending.reference
            } else {
                val id = context.sync.id(
                    ComponentStyleReferencesTable, ComponentStyleReferencesTable.id,
                    ComponentStyleReferencesTable.invariantPropertyValueId to
                        (pending.source as? ComponentStyleSource.Invariant)?.id,
                    ComponentStyleReferencesTable.variationPropertyValueId to
                        (pending.source as? ComponentStyleSource.Variation)?.id,
                    ComponentStyleReferencesTable.styleCombinationId to
                        (pending.source as? ComponentStyleSource.Combination)?.id,
                ) ?: StableComponentStyleReferencesTable.insertReturning {
                    it[designSystemId] = ds
                }.single()[StableComponentStyleReferencesTable.id]
                context.sync.write(
                    ComponentStyleReferenceRevisionsTable,
                    ComponentStyleReferencesTable,
                    ComponentStyleReferenceRevisionsTable.entityId,
                    id,
                    ds,
                ) { statement ->
                    statement[invariantPropertyValueId] = (pending.source as? ComponentStyleSource.Invariant)?.id
                    statement[variationPropertyValueId] = (pending.source as? ComponentStyleSource.Variation)?.id
                    statement[styleCombinationId] = (pending.source as? ComponentStyleSource.Combination)?.id
                    statement[targetAppearanceId] = target[ComponentAppearancesTable.id]
                    statement[reference] = pending.reference
                }
                targetStyles.distinct().forEach { style ->
                    val styleId = context.sync.id(
                        ComponentStyleReferenceStylesTable, ComponentStyleReferenceStylesTable.id,
                        ComponentStyleReferenceStylesTable.referenceId to id,
                        ComponentStyleReferenceStylesTable.styleId to style,
                    ) ?: StableComponentStyleReferenceStylesTable.insertReturning {
                        it[referenceId] = id
                        it[designSystemId] = ds
                    }.single()[StableComponentStyleReferenceStylesTable.id]
                    context.sync.write(
                        ComponentStyleReferenceStyleRevisionsTable,
                        ComponentStyleReferenceStylesTable,
                        ComponentStyleReferenceStyleRevisionsTable.entityId,
                        styleId,
                        ds,
                    ) { statement -> statement[ComponentStyleReferenceStyleRevisionsTable.styleId] = style }
                }
            }
        }

    private fun referenceStyles(ds: UUID, component: UUID): Map<String, UUID> = ComponentStylesTable.join(
        VariationsTable,
        JoinType.INNER,
        ComponentStylesTable.variationId,
        VariationsTable.id,
    ).selectAll().where {
        (ComponentStylesTable.designSystemId eq ds) and (VariationsTable.componentId eq component)
    }.associate { it[ComponentStylesTable.name] to it[ComponentStylesTable.id] }

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

    /** One row per state set: a repeated state set in the config is collapsed, the last one wins. */
    private fun expand(p: ComponentConfig.Property): List<Expanded> =
        expandAll(p).associateBy { it.states }.values.toList()

    private fun expandAll(
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

private val RANK: Comparator<Pair<Int, Int>> = compareBy({ it.first }, { it.second })
