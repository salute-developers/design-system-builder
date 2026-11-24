package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ComponentConfigRepository
import com.dsbuilder.ds.components.application.ImportComponentConfig
import com.dsbuilder.ds.components.domain.ComponentConfig
import com.dsbuilder.ds.components.domain.ConfigurationName
import com.dsbuilder.ds.components.domain.EditorAxisValue
import com.dsbuilder.ds.components.domain.RootCandidate
import com.dsbuilder.ds.components.domain.StateNames
import com.dsbuilder.ds.components.domain.fallbackRoot
import kotlinx.serialization.json.JsonPrimitive
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNotNull
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.lowerCase
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
        entries.forEach {
            importOne(command.designSystemId, it, context)
            context.sync.flush()
        }
        resolveReferences(command.designSystemId, context)
        context.sync.flush()
        // Всё, что записано в оформление, созданное этим импортом, удерживается им же: очищать нечего.
        context.appearances.filterNot { it in context.newAppearances }.forEach {
            context.sync.appearance = it
            clear(it, context.sync)
        }
        context.sync.flush()
        context.completed.forEach { it() }
        ComponentConfigRepository.ImportAttempt.Success(
            context.report.toDomain(context.paintTypes.mapValues { it.value.toSet() }),
        )
    }.getOrElse { ComponentConfigRepository.ImportAttempt.Failed(it.message ?: it.toString()) }

    private fun createContext(command: ImportComponentConfig) = ComponentConfigImportContext(
        command.designSystemId,
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

    /** Причина отклонить запись до записи в базу: неподдержанный тип свойства или корень не из осей. */
    private fun entryProblem(entry: ImportComponentConfig.Entry): String? =
        invalidType(entry)?.let { "Unsupported property type '$it'" }
            ?: unknownRoot(entry.config)?.let { "rootVariationId '$it' names no axis of the configuration" }

    /**
     * Новая конфигурация получает имя только по правилу kebab-case и не может дать тот же идентификатор в коде, что и
     * существующая (`dense-2` и `dense2`); существующая со старым именем обновляется без проверки.
     */
    private fun newNameProblem(ds: UUID, componentId: UUID, name: String): String? = when {
        !ConfigurationName.isValid(name) -> ConfigurationName.INVALID_CODE
        ConfigurationName.key(name) in AppearanceNaming.names(ds, componentId) -> ConfigurationName.TAKEN_CODE
        else -> null
    }

    @Suppress("LongMethod", "ReturnCount")
    private fun importOne(ds: UUID, entry: ImportComponentConfig.Entry, context: ComponentConfigImportContext) {
        entryProblem(entry)?.let { return context.report.reject(entry, it) }
        val component = component(entry.componentName, context) ?: return context.report.reject(
            entry,
            "Component '${entry.componentName}' is not present in the global layer for platform " +
                "'${context.platform.wireValue}'",
        )
        val componentId = component[ComponentsTable.id]
        link(ds, componentId, context)
        loadStates(componentId, context)
        val old = appearance(ds, componentId, entry.styleName)
        if (old == null) {
            newNameProblem(
                ds,
                componentId,
                entry.styleName,
            )?.let { return context.report.reject(entry, it) }
        }
        val appearanceId = old?.get(ComponentAppearancesTable.id) ?: run {
            val id = StableAppearancesTable.insertReturning {
                it[designSystemId] = ds
                it[StableAppearancesTable.componentId] = componentId
            }.single()[StableAppearancesTable.id]
            val first = isFirstAppearanceOfComponent(ds, componentId, id)
            AppearanceRevisionsTable.replaceRevision(
                AppearanceRevisionsTable.entityId,
                id,
                ds,
                draft = context.sync.draft(ds),
            ) { statement ->
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
        context.sync.appearance = appearanceId
        // Конфигурация «до» собирается лениво, перед первым изменением оформления: если ничего не меняется, обе сборки
        // для сравнения не нужны.
        val before = captureBefore(old != null, descriptor, context)
        val names = if (old != null) EffectiveNameSnapshot.capture(appearanceId) else EffectiveNameSnapshot.EMPTY
        ambiguousNameProblem(old != null, ds, componentId, entry, names, context)?.let {
            return context.report.reject(entry, it)
        }
        context.track(appearanceId, created = old == null)
        val (config, axes, trailing) = upsertAxesWithView(ds, componentId, entry.config, names)
        val styles = upsertStyles(ds, config, axes, names, context)
        declareAxes(appearanceId, config, axes, styles, names, context, trailing)
        val properties = properties(componentId, entry, context)
        writeInvariants(ds, componentId, appearanceId, config, properties, context)
        writeVariations(appearanceId, config, axes, styles, properties, context, trailing)
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
                // Ничего не изменялось: сборки «до» нет, а конфигурация осталась прежней.
                !context.sync.changed(appearanceId) -> context.report.unchanged++
                // Строки записывались: различает «обновлено» и «не изменено» итоговая конфигурация оформления.
                before.config == builder.build(descriptor, true, linkedSetOf()) -> context.report.unchanged++
                else -> context.report.updated++
            }
        }
    }

    /** Конфигурация оформления «до» импорта; заполняется перед первым изменением оформления. */
    private class BeforeConfig {
        var config: Any? = null
    }

    private fun captureBefore(existing: Boolean, descriptor: ConfigAppearance, context: ComponentConfigImportContext) =
        BeforeConfig().also { before ->
            if (existing) {
                context.sync.onFirstChange(descriptor.id) {
                    before.config = builder.build(descriptor, true, linkedSetOf())
                }
            }
        }

    /**
     * Причина отклонить запись из-за неоднозначного имени. У нового оформления нет действующих имён, которые можно
     * спутать с именами каталога, поэтому для него проверка пуста.
     */
    private fun ambiguousNameProblem(
        existing: Boolean,
        ds: UUID,
        component: UUID,
        entry: ImportComponentConfig.Entry,
        names: EffectiveNameSnapshot,
        context: ComponentConfigImportContext,
    ): String? = if (existing) {
        ambiguousName(ds, component, entry.config, names, context)?.let {
            "Name '$it' is the display name of one axis or value and the catalog name of another; " +
                "import the configuration exported from this design system"
        }
    } else {
        null
    }

    /**
     * Имя конфигурации, которое по действующему имени указывает на одну ось или значение оформления, а по имени
     * каталога на другое: после перестановки имён такая запись склеила бы вариации, поэтому она отклоняется.
     */
    private fun ambiguousName(
        ds: UUID,
        component: UUID,
        config: ComponentConfig,
        names: EffectiveNameSnapshot,
        context: ComponentConfigImportContext,
    ): String? {
        val catalogAxes = VariationsTable.selectAll().where {
            (VariationsTable.designSystemId eq ds) and (VariationsTable.componentId eq component)
        }.associate { it[VariationsTable.name] to it[VariationsTable.id] }
        axes(config).forEach { (_, name) ->
            val effective = names.axis(name)?.variationId
            val catalog = catalogAxes[name]
            val differs = effective != null && catalog != null && effective != catalog
            if (differs && names.hasAxis(requireNotNull(catalog))) return name
        }
        val axisNames = axes(config).toMap()
        axisValues(config).forEach { (axisId, value) ->
            val axisName = axisNames[axisId] ?: return@forEach
            val variation = names.axis(axisName)?.variationId ?: catalogAxes[axisName] ?: return@forEach
            val effective = names.value(variation, value)?.styleId ?: return@forEach
            val catalog = existingStyle(ds, variation, value, context)
            if (catalog != null && catalog != effective && names.hasValue(catalog)) return value
        }
        return null
    }

    /** Компонент платформы по имени; каталог платформы читается один раз, при совпадении имён берётся первая строка. */
    private fun component(name: String, context: ComponentConfigImportContext): ResultRow? =
        platformComponents(context)[name.canonical()]

    private fun platformComponents(context: ComponentConfigImportContext): Map<String, ResultRow> =
        context.platformComponents ?: linkedMapOf<String, ResultRow>().also { index ->
            ComponentsTable.selectAll().where { ComponentsTable.platform eq context.platform }
                .forEach { index.putIfAbsent(it[ComponentsTable.name].canonical(), it) }
            context.platformComponents = index
        }

    private fun link(ds: UUID, component: UUID, context: ComponentConfigImportContext) {
        if (context.linkedComponents.add(component)) restoreDesignSystemComponentLink(ds, component)
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
        ds: UUID,
        component: UUID,
        config: ComponentConfig,
        names: EffectiveNameSnapshot,
    ) = axes(config).associate { (key, name) ->
        key to (names.axis(name)?.variationId ?: VariationWrites.findOrCreate(ds, component, name))
    }

    /** Дополненная конфигурация, её оси и id оси `view`, добавленной импортом (`null`, если `view` была в пакете). */
    private data class AxesWithView(
        val config: ComponentConfig,
        val axes: Map<String, UUID>,
        val trailingAxisId: String?,
    )

    /** Оси конфигурации вместе с осью `view`, если её нет в импорте, и сама дополненная конфигурация. */
    private fun upsertAxesWithView(
        ds: UUID,
        component: UUID,
        config: ComponentConfig,
        names: EffectiveNameSnapshot,
    ): AxesWithView {
        val declared = upsertAxes(ds, component, config, names)
        val withView = withViewAxis(ds, component, config, declared)
            ?: return AxesWithView(config, declared, trailingAxisId = null)
        return AxesWithView(withView.first, upsertAxes(ds, component, withView.first, names), withView.second)
    }

    /**
     * Конфигурация, у которой есть вариация `view`: если ни одна ось импорта не указывает на вариацию каталога `view`,
     * она добавляется последней осью со значением `default` по умолчанию: последней и после осей, заданных только в
     * `targets`, — её id возвращается, и порядок осей (`axes`) ставит её в конец. Импорт заменяет объявление конфигурации
     * целиком, поэтому ось дописывается в саму конфигурацию, а не отдельной записью: так очистка импорта её не снимает,
     * а повторный импорт той же конфигурации ничего не меняет.
     */
    private fun withViewAxis(
        ds: UUID,
        component: UUID,
        config: ComponentConfig,
        axes: Map<String, UUID>,
    ): Pair<ComponentConfig, String>? {
        val hasView = axes.isNotEmpty() && VariationsTable.selectAll().where {
            (VariationsTable.id inList axes.values) and (VariationsTable.name.lowerCase() eq ViewAxis.NAME)
        }.any()
        if (hasView) return null
        val name = VariationWrites.find(ds, component, ViewAxis.NAME, ignoreCase = true)?.let { id ->
            VariationsTable.selectAll().where { VariationsTable.id eq id }.single()[VariationsTable.name]
        } ?: ViewAxis.NAME
        val id = generateSequence(0) { it + 1 }.map { if (it == 0) ViewAxis.NAME else "${ViewAxis.NAME}-$it" }
            .first { candidate -> axes(config).none { it.first == candidate } }
        val default = ComponentConfig.Default(id, ComponentConfig.Scalar.Text(ViewAxis.DEFAULT_VALUE))
        return config.copy(
            defaults = config.defaults + default,
            variations = config.variations + ComponentConfig.Variation(
                id = id,
                name = name,
                values = listOf(ComponentConfig.VariationValue(ViewAxis.DEFAULT_VALUE, properties = emptyMap())),
            ),
        ) to id
    }

    private fun upsertStyles(
        ds: UUID,
        config: ComponentConfig,
        axes: Map<String, UUID>,
        names: EffectiveNameSnapshot,
        context: ComponentConfigImportContext,
    ) = axisValues(config).associate { (axis, value) ->
        val variation = axes.getValue(axis)
        styleKey(axis, value) to (
            names.value(variation, value)?.styleId ?: existingStyle(ds, variation, value, context) ?: run {
                val id = StableStylesTable.insertReturning {
                    it[designSystemId] = ds
                    it[variationId] = variation
                }.single()[StableStylesTable.id]
                StyleRevisionsTable.replaceRevision(
                    StyleRevisionsTable.entityId,
                    id,
                    ds,
                    draft = context.sync.draft(ds),
                ) { statement ->
                    statement[name] = value
                    statement[description] = null
                }
                context.styleIds.getValue(variation)[value] = listOf(id)
                id
            }
            )
    }

    /** Стиль оси по имени: стили оси читаются один раз на импорт, а повтор имени (неоднозначность) даёт `null`. */
    private fun existingStyle(ds: UUID, variation: UUID, name: String, context: ComponentConfigImportContext): UUID? =
        context.styleIds.getOrPut(variation) {
            ComponentStylesTable.selectAll().where {
                (ComponentStylesTable.designSystemId eq ds) and (ComponentStylesTable.variationId eq variation)
            }.groupBy({ it[ComponentStylesTable.name] }, { it[ComponentStylesTable.id] }).toMutableMap()
        }[name]?.singleOrNull()

    @Suppress("LongMethod")
    private fun declareAxes(
        id: UUID,
        config: ComponentConfig,
        axes: Map<String, UUID>,
        styles: Map<String, UUID>,
        names: EffectiveNameSnapshot,
        context: ComponentConfigImportContext,
        trailingAxisId: String?,
    ) {
        val values = axisValues(config).groupBy({ it.first }, { it.second })
        val defaults = config.defaults.associate { it.id to it.value.text() }
        axes(config, trailingAxisId).forEachIndexed { position, (axisId, axisName) ->
            val declared = config.variations.firstOrNull { it.id == axisId }
            val existing = StableAppearanceVariationsTable.selectAll().where {
                (StableAppearanceVariationsTable.appearanceId eq id) and
                    (StableAppearanceVariationsTable.variationId eq axes.getValue(axisId))
            }.singleOrNull()?.get(StableAppearanceVariationsTable.id)
            val row = existing ?: StableAppearanceVariationsTable.insertReturning {
                it[appearanceId] = id
                it[variationId] = axes.getValue(axisId)
                it[designSystemId] = context.designSystemId
            }.single()[StableAppearanceVariationsTable.id]
            val ds = context.designSystemId
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
                val valueId = context.sync.idOrCreate(
                    AppearanceVariationValuesTable,
                    AppearanceVariationValuesTable.id,
                    AppearanceVariationValuesTable.appearanceVariationId to row,
                    AppearanceVariationValuesTable.styleId to style,
                ) {
                    context.sync.stable(
                        ds,
                        StableAppearanceVariationValuesTable,
                        StableAppearanceVariationValuesTable.id,
                        StableAppearanceVariationValuesTable.createdAt,
                    ) { statement ->
                        statement[appearanceVariationId] = row
                        statement[designSystemId] = ds
                    }
                }
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
        storeRoles(id, config, axes, context, trailingAxisId)
    }

    /** Сохраняет роли осей; корень, не указанный в конфигурации, выбирается по правилу фолбэка. */
    private fun storeRoles(
        id: UUID,
        config: ComponentConfig,
        axes: Map<String, UUID>,
        context: ComponentConfigImportContext,
        trailingAxisId: String?,
    ) {
        val colorScheme = config.colorSchemeVariationId?.let(axes::get)
        val root = config.rootVariationId?.let(axes::get) ?: fallbackRoot(
            axes(config, trailingAxisId).mapIndexed { position, (key, name) ->
                RootCandidate(axes.getValue(key), name, position)
            },
            colorScheme,
        )
        val current = AppearanceAxisRoleStore.load(listOf(id)).getValue(id)
        if (current.root == root && current.colorScheme == colorScheme) return
        context.sync.markChanged()
        AppearanceAxisRoleStore.store(id, root, colorScheme)
    }

    /** Возвращает указанный в конфигурации корень, если он не совпадает ни с одной осью. */
    private fun unknownRoot(config: ComponentConfig): String? =
        config.rootVariationId?.takeIf { root -> axes(config).none { it.first == root } }

    private fun properties(component: UUID, entry: ImportComponentConfig.Entry, context: ComponentConfigImportContext) =
        propertyNames(entry.config).let { names ->
            val rows = context.propertyRows.getOrPut(component) {
                val byName = linkedMapOf<String, ResultRow>()
                PropertiesTable.selectAll().where { PropertiesTable.componentId eq component }
                    .forEach { byName.putIfAbsent(it[PropertiesTable.name].canonical(), it) }
                byName
            }
            val types = propertyTypes(entry.config)
            names.mapNotNull { name -> property(name, rows[name.canonical()], types, entry, context) }.toMap()
        }

    private fun property(
        name: String,
        row: ResultRow?,
        types: Map<String, Set<String>>,
        entry: ImportComponentConfig.Entry,
        context: ComponentConfigImportContext,
    ): Pair<String, UUID>? {
        if (row == null) {
            context.report.unknownProperties += name
            return null
        }
        val global = row[PropertiesTable.type].wireValue
        val declared = types[name].orEmpty()
        if (global in paintTypes) {
            context.paintTypes.getOrPut("${entry.componentName}.$name") { linkedSetOf() }
                .addAll(declared.filter(paintTypes::contains))
        }
        if (declared.isNotEmpty() && declared.none { compatible(global, it) }) {
            val configTypes = declared.sorted().joinToString("/")
            context.report.typeMismatches += "$name: global '$global', config '$configTypes'"
        }
        return name to row[PropertiesTable.id]
    }

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
            val id = context.sync.idOrCreate(
                InvariantPropertyValuesTable,
                InvariantPropertyValuesTable.id,
                InvariantPropertyValuesTable.appearanceId to appearance,
                InvariantPropertyValuesTable.propertyId to propertyId,
                InvariantPropertyValuesTable.stateSetId to states,
            ) {
                context.sync.stable(
                    ds,
                    StableInvariantPropertyValuesTable,
                    StableInvariantPropertyValuesTable.id,
                    StableInvariantPropertyValuesTable.createdAt,
                ) { statement ->
                    statement[StableInvariantPropertyValuesTable.propertyId] = propertyId
                    statement[designSystemId] = ds
                    statement[componentId] = component
                    statement[appearanceId] = appearance
                }
            }
            context.sync.write(
                InvariantPropertyValueRevisionsTable,
                InvariantPropertyValuesTable,
                InvariantPropertyValueRevisionsTable.entityId,
                id,
                ds,
            ) { statement ->
                val token = token(value.token, value.tokenType, context)
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
        trailingAxisId: String?,
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
                    linkProperty(propertyId, axes.getValue(axis.id), context)
                    expand(property, allowStateOnly = targets.isNotEmpty()).forEach { expanded ->
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
        val rank = canonicalRank(config, styles, trailingAxisId)
        val unranked = Int.MAX_VALUE to Int.MAX_VALUE
        fun ranks(members: List<UUID>) = members.map { rank[it] ?: unranked }.sortedWith(RANK)
        val ordered = declarations.values.sortedWith { left, right ->
            compareRanks(ranks(left.first), ranks(right.first))
        }
        ordered.forEachIndexed { position, (members, authored) ->
            val ds = context.designSystemId
            val key = members.joinToString(",")
            val id = context.sync.idOrCreate(
                AppearanceCombinationsTable,
                AppearanceCombinationsTable.id,
                AppearanceCombinationsTable.appearanceId to appearance,
                AppearanceCombinationsTable.combinationKey to key,
            ) {
                StableAppearanceCombinationsTable.insertReturning {
                    it[appearanceId] = appearance
                    it[designSystemId] = ds
                }.single()[StableAppearanceCombinationsTable.id]
            }
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
                val memberId = context.sync.idOrCreate(
                    AppearanceCombinationMembersTable,
                    AppearanceCombinationMembersTable.id,
                    AppearanceCombinationMembersTable.appearanceCombinationId to id,
                    AppearanceCombinationMembersTable.styleId to style,
                ) {
                    StableAppearanceCombinationMembersTable.insertReturning {
                        it[appearanceCombinationId] = id
                        it[designSystemId] = ds
                    }.single()[StableAppearanceCombinationMembersTable.id]
                }
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
    private fun canonicalRank(
        config: ComponentConfig,
        styles: Map<String, UUID>,
        trailingAxisId: String?,
    ): Map<UUID, Pair<Int, Int>> {
        val values = axisValues(config).groupBy({ it.first }, { it.second })
        return buildMap {
            axes(config, trailingAxisId).forEachIndexed { axisIndex, (axisId, _) ->
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
        val ds = c.designSystemId
        val id = c.sync.idOrCreate(
            VariationPropertyValuesTable,
            VariationPropertyValuesTable.id,
            VariationPropertyValuesTable.appearanceId to a,
            VariationPropertyValuesTable.propertyId to p,
            VariationPropertyValuesTable.styleId to s,
            VariationPropertyValuesTable.stateSetId to states,
        ) {
            c.sync.stable(
                ds,
                StableVariationPropertyValuesTable,
                StableVariationPropertyValuesTable.id,
                StableVariationPropertyValuesTable.createdAt,
            ) { statement ->
                statement[propertyId] = p
                statement[styleId] = s
                statement[appearanceId] = a
                statement[designSystemId] = ds
            }
        }
        c.sync.write(
            VariationPropertyValueRevisionsTable,
            VariationPropertyValuesTable,
            VariationPropertyValueRevisionsTable.entityId,
            id,
            ds,
        ) { statement ->
            val token = token(value.token, value.tokenType, c)
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
        val ds = c.designSystemId
        val key = members.joinToString(",")
        val id = c.sync.idOrCreate(
            StyleCombinationsTable,
            StyleCombinationsTable.id,
            StyleCombinationsTable.appearanceId to a,
            StyleCombinationsTable.propertyId to p,
            StyleCombinationsTable.combinationKey to key,
            StyleCombinationsTable.stateSetId to states,
        ) {
            StableStyleCombinationsTable.insertReturning {
                it[propertyId] = p
                it[appearanceId] = a
                it[designSystemId] = ds
            }.single()[StableStyleCombinationsTable.id]
        }
        c.sync.write(
            StyleCombinationRevisionsTable,
            StyleCombinationsTable,
            StyleCombinationRevisionsTable.entityId,
            id,
            ds,
        ) { statement ->
            statement[combinationKey] = key
            statement[StyleCombinationRevisionsTable.value] = value.value.orEmpty()
            statement[tokenId] = token(value.token, value.tokenType, c)
            statement[alpha] = value.alpha
            statement[adjustment] = value.adjustment
            statement[position] = value.position
            statement[stateSetId] = states
        }
        members.forEach { style ->
            val memberId = c.sync.idOrCreate(
                StyleCombinationMembersTable,
                StyleCombinationMembersTable.id,
                StyleCombinationMembersTable.combinationId to id,
                StyleCombinationMembersTable.styleId to style,
            ) {
                StableStyleCombinationMembersTable.insertReturning {
                    it[combinationId] = id
                    it[designSystemId] = ds
                }.single()[StableStyleCombinationMembersTable.id]
            }
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

    /** Связь свойства с осью: связи оси читаются один раз на ось, недостающая вставляется. */
    private fun linkProperty(property: UUID, variation: UUID, context: ComponentConfigImportContext) {
        val linked = context.linkedProperties.getOrPut(variation) {
            PropertyVariationsTable.selectAll().where { PropertyVariationsTable.variationId eq variation }
                .mapTo(hashSetOf()) { it[PropertyVariationsTable.propertyId] }
        }
        if (linked.add(property)) {
            PropertyVariationsTable.insertReturning {
                it[propertyId] = property
                it[variationId] = variation
                it[designSystemId] = context.designSystemId
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
        context.componentStates += context.statesByComponent.getOrPut(component) {
            ComponentStatesTable.selectAll().where { ComponentStatesTable.componentId eq component }
                .associate { it[ComponentStatesTable.name].canonical() to it[ComponentStatesTable.id] }
        }
    }

    private fun reference(
        property: ComponentConfig.Property,
        value: Expanded,
        source: ComponentStyleSource,
        context: ComponentConfigImportContext,
    ) {
        if (property.type == componentStyle && value.value != null) {
            context.pendingReferences += PendingComponentStyleReference(value.value, source, context.sync.appearance)
        }
    }

    private fun resolveReferences(ds: UUID, context: ComponentConfigImportContext) =
        context.pendingReferences.forEach { pending ->
            context.sync.appearance = pending.appearance
            val parts = pending.reference.split('.')
            val styleName = parts.first()
            val componentName = context.styleToComponent[styleName] ?: styleName
            val component = component(componentName, context)?.get(ComponentsTable.id)
            val resolved = component?.let { referenceTarget(ds, it, styleName, context) }
            val target = resolved?.appearance
            val targetStyles = resolved?.let { targetStyles(parts.drop(1), it) }
            if (target == null || targetStyles == null) {
                context.report.unresolvedComponentStyles += pending.reference
            } else {
                writeReference(ds, pending, target, targetStyles, context)
            }
        }

    /** Записывает ссылку на стиль и её целевые стили: ссылка создаётся по адресу значения-источника. */
    private fun writeReference(
        ds: UUID,
        pending: PendingComponentStyleReference,
        target: ResultRow,
        targetStyles: List<UUID>,
        context: ComponentConfigImportContext,
    ) {
        val id = context.sync.idOrCreate(
            ComponentStyleReferencesTable,
            ComponentStyleReferencesTable.id,
            ComponentStyleReferencesTable.invariantPropertyValueId to
                (pending.source as? ComponentStyleSource.Invariant)?.id,
            ComponentStyleReferencesTable.variationPropertyValueId to
                (pending.source as? ComponentStyleSource.Variation)?.id,
            ComponentStyleReferencesTable.styleCombinationId to
                (pending.source as? ComponentStyleSource.Combination)?.id,
        ) {
            StableComponentStyleReferencesTable.insertReturning {
                it[designSystemId] = ds
            }.single()[StableComponentStyleReferencesTable.id]
        }
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
            val styleId = context.sync.idOrCreate(
                ComponentStyleReferenceStylesTable,
                ComponentStyleReferenceStylesTable.id,
                ComponentStyleReferenceStylesTable.referenceId to id,
                ComponentStyleReferenceStylesTable.styleId to style,
            ) {
                StableComponentStyleReferenceStylesTable.insertReturning {
                    it[referenceId] = id
                    it[designSystemId] = ds
                }.single()[StableComponentStyleReferenceStylesTable.id]
            }
            context.sync.write(
                ComponentStyleReferenceStyleRevisionsTable,
                ComponentStyleReferenceStylesTable,
                ComponentStyleReferenceStyleRevisionsTable.entityId,
                styleId,
                ds,
            ) { statement -> statement[ComponentStyleReferenceStyleRevisionsTable.styleId] = style }
        }
    }

    /**
     * Стили, на которые указывает хвост ссылки. Сначала действует прежнее правило: каждый сегмент — имя значения
     * вариации или имя стиля компонента. Только если оно не покрыло хвост, хвост раскладывается на группы с
     * исходными идентификаторами значений и сочетаний цели ([ReferenceSegments]).
     */
    private fun targetStyles(tail: List<String>, target: ReferenceTarget): List<UUID>? {
        fun byName(segment: String) = target.effective[segment.trim().lowercase()] ?: target.available[segment]
        val byNames = tail.mapNotNull(::byName)
        return if (byNames.size == tail.size) byNames else ReferenceSegments.resolve(tail, ::byName, target.authored)
    }

    /** Цель ссылки и её стили читаются один раз: ссылок на одно оформление в пакете много. */
    private fun referenceTarget(
        ds: UUID,
        component: UUID,
        styleName: String,
        context: ComponentConfigImportContext,
    ): ReferenceTarget = context.referenceTargets.getOrPut(component to styleName) {
        val appearance = appearance(ds, component, styleName)
        val values = appearance?.let {
            AppearanceEditorModelReader.axes(it[ComponentAppearancesTable.id], ds, null).flatMap { axis -> axis.values }
        }.orEmpty()
        ReferenceTarget(
            appearance,
            referenceStyles(ds, component),
            // Значения вариаций целевого оформления по действующему имени: ссылки экспорта написаны этими именами.
            values.associate { it.name.trim().lowercase() to it.styleId },
            appearance?.let { authoredStyles(it[ComponentAppearancesTable.id], values) }.orEmpty(),
        )
    }

    /**
     * Стили значений и сочетаний по исходному идентификатору из пакета. Значение раньше сочетания при совпадении
     * идентификаторов, внутри одной таблицы первое по позиции. Сочетания читаются одним запросом с `JOIN` участников.
     */
    private fun authoredStyles(appearanceId: UUID, values: List<EditorAxisValue>): Map<String, List<UUID>> {
        val authored = linkedMapOf<String, List<UUID>>()
        // Пустой идентификатор никого не адресует: пустой сегмент ссылки не должен с ним совпасть.
        values.forEach { value ->
            value.authoredId?.takeIf { it.isNotEmpty() }?.let { authored.putIfAbsent(it, listOf(value.styleId)) }
        }
        AppearanceCombinationsTable.join(
            AppearanceCombinationMembersTable,
            JoinType.INNER,
            AppearanceCombinationsTable.id,
            AppearanceCombinationMembersTable.appearanceCombinationId,
        ).selectAll().where {
            (AppearanceCombinationsTable.appearanceId eq appearanceId) and
                AppearanceCombinationsTable.authoredId.isNotNull()
        }.orderBy(
            AppearanceCombinationsTable.position to SortOrder.ASC,
            AppearanceCombinationMembersTable.position to SortOrder.ASC,
        ).groupBy { it[AppearanceCombinationsTable.id] }.values.forEach { members ->
            // Группировка по сочетанию, а не по идентификатору: два сочетания с одним идентификатором не склеиваются.
            members.first()[AppearanceCombinationsTable.authoredId]?.takeIf { it.isNotEmpty() }?.let {
                authored.putIfAbsent(it, members.map { row -> row[AppearanceCombinationMembersTable.styleId] })
            }
        }
        return authored
    }

    private fun referenceStyles(ds: UUID, component: UUID): Map<String, UUID> = ComponentStylesTable.join(
        VariationsTable,
        JoinType.INNER,
        ComponentStylesTable.variationId,
        VariationsTable.id,
    ).selectAll().where {
        (ComponentStylesTable.designSystemId eq ds) and (VariationsTable.componentId eq component)
    }.associate { it[ComponentStylesTable.name] to it[ComponentStylesTable.id] }

    /** Дочерние компоненты со связью `REUSE`: читаются один раз на родителя, дополняются при вставке. */
    private fun reuseChildren(parent: UUID, context: ComponentConfigImportContext): MutableSet<UUID> =
        context.reuseChildren.getOrPut(parent) {
            ComponentDependenciesTable.selectAll().where {
                (ComponentDependenciesTable.parentId eq parent) and
                    (ComponentDependenciesTable.type eq RelationTypeDb.REUSE)
            }.mapTo(hashSetOf()) { it[ComponentDependenciesTable.childId] }
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
            } else if (child != component && child !in reuseChildren(component, context)) {
                ComponentDependenciesTable.insertReturning {
                    it[parentId] = component
                    it[childId] = child
                    it[type] = RelationTypeDb.REUSE
                    it[order] = null
                }.single()
                reuseChildren(component, context) += child
            }
        }

    /** Токен ссылки по правилам [referenceCandidates]; ненайденное имя, кроме литерала CSS, попадает в отчёт. */
    private fun token(name: String?, type: String?, context: ComponentConfigImportContext): UUID? = name?.let {
        referenceCandidates(it, type).firstNotNullOfOrNull(context.tokens::get) ?: run {
            if (!isLiteralValue(it)) context.report.unresolvedTokens += it
            null
        }
    }
    private fun invalidType(entry: ImportComponentConfig.Entry) = allProperties(entry.config)
        .flatMap { listOf(it.type) + it.states.mapNotNull(ComponentConfig.State::type) }
        .firstOrNull { it !in valueTypes }

    /**
     * Оси конфигурации по порядку: объявленные вариации, затем оси, заданные только в `targets`. Ось `trailingAxisId`
     * (`view`, добавленная импортом) ставится последней.
     */
    private fun axes(config: ComponentConfig, trailingAxisId: String? = null): List<Pair<String, String>> {
        val ordered = buildList {
            addAll(config.variations.map { it.id to it.name })
            config.variations.flatMap { it.values }.flatMap { it.targets.orEmpty() }.flatMap { it.properties }
                .forEach { if (none { axis -> axis.first == it.id }) add(it.id to it.id) }
        }
        val (trailing, rest) = ordered.partition { it.first == trailingAxisId }
        return rest + trailing
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
    private fun expand(p: ComponentConfig.Property, allowStateOnly: Boolean = false): List<Expanded> =
        expandAll(p, allowStateOnly).associateBy { it.states }.values.toList()

    private fun expandAll(
        p: ComponentConfig.Property,
        allowStateOnly: Boolean,
    ): List<Expanded> {
        val stateOnly = allowStateOnly && p.value == ComponentConfig.Scalar.Null &&
            p.states.any { it.state.isNotEmpty() }
        return listOfNotNull(
            Expanded(
                p.value.raw(),
                tokenName(p.type, p.value),
                p.type,
                p.alpha?.raw(),
                p.adjustment?.raw(),
                emptyList(),
                0,
            ).takeUnless { stateOnly },
        ) +
            p.states.mapIndexedNotNull { index, state ->
                state.state.sorted().takeIf { it.isNotEmpty() }?.let {
                    Expanded(
                        state.value.raw(),
                        tokenName(state.type ?: p.type, state.value),
                        state.type ?: p.type,
                        state.alpha?.raw(),
                        null,
                        it,
                        index + if (stateOnly) 0 else 1,
                    )
                }
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
        val tokenType: String?,
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

/** Каноническое имя состояния; общие состояния разрешаются раньше собственных (см. [StateNames.resolve]). */
private fun String.canonical() = StateNames.canonical(this)
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
