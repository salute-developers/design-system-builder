package com.dsbuilder.frontend.feature.components.domain.codec

import kotlinx.serialization.json.JsonPrimitive

/**
 * Сочетание значений осей, однозначно задающее одну native-вариацию.
 */
internal typealias AxisCombination = List<Pair<String, JsonPrimitive>>

/**
 * Накапливает native-конфигурацию, собираемую из значений common-формата.
 */
internal class NativeAccumulator(
    private val config: CommonConfig,
) {
    private val canonical = config.canonicalAxisValues()

    /**
     * Имя оси по её идентификатору.
     *
     * Common-формат различает идентификатор оси и её имя, native — нет: в `bindings[].name`
     * и `binding[].name` стоит имя. Прежде сюда подставлялся идентификатор, и выгруженная
     * конфигурация получила бы uuid вместо `size` везде, где эти два поля различаются.
     */
    private val axisNames = config.variations.associate { it.id to it.name }

    /**
     * Порядок осей, объявленный конфигурацией.
     *
     * По нему канонизируется координата. Без этого одна и та же координата собиралась дважды
     * с разным порядком осей: у значения обычной оси `targets` приходят в одном порядке,
     * у значения оси цветовой схемы — в другом, и `builders` заводил два ключа вместо одного.
     * Второй оставался без авторского идентификатора и уезжал в пакет лишней вариацией
     * вроде `no.size-48` вместо `size-48.bg-no`.
     */
    private val axisOrder = config.variations.withIndex().associate { (index, it) -> it.id to index }

    /** Приводит координату к объявленному порядку осей. */
    private fun AxisCombination.canonical(): AxisCombination =
        sortedBy { axisOrder[it.first] ?: Int.MAX_VALUE }
    private val defaults = config.defaults.associate { it.id to it.value }
    private val rootView = linkedMapOf<String, NativeViewEntry>()
    private val builders = linkedMapOf<AxisCombination, NativeVariationBuilder>()

    /**
     * Идентификаторы вариаций, пришедшие из общего формата.
     *
     * Собираются до сборки: `parent` вычисляется по координате без последней оси, и её
     * идентификатор к этому моменту уже должен быть известен.
     */
    private val authoredIds = mutableMapOf<AxisCombination, String>()

    /** Координаты пустых вариаций исходника. Достраиваются в [build], если их не завело ничто. */
    private val emptyWithAuthoredId = mutableMapOf<AxisCombination, String>()

    private val axisValues = config.variations.associate { it.id to linkedSetOf<JsonPrimitive>() }

    fun add(axis: String, value: CommonVariationValue) {
        val targets = value.targets.orEmpty().flatMap { it.properties }
        targets.forEach { axisValues.getValue(it.id) += it.value }

        val own = canonical[axis to value.name] ?: JsonPrimitive(value.name)
        axisValues.getValue(axis) += own

        // Значение, которому не сопоставлено ни свойств, ни пересечений, объявлено осью,
        // но ничего не переопределяет. Оно остаётся в `bindings[].values` и вариации
        // не порождает — если только в исходнике вариации у него не было.
        //
        // Признак этого — авторский идентификатор: он ставится только из `variations[].id`,
        // поэтому его наличие означает, что запись вариации в native-формате существовала,
        // пусть и пустая. Такая в корпусе одна на 1219 — `counter.type=mute` в `sdds_sbcom`, —
        // и без неё плагин теряет обёртку `Counter.Mute` целиком.
        // Значение, которому не сопоставлено ни свойств, ни пересечений, объявлено осью,
        // но ничего не переопределяет: оно остаётся в `bindings[].values` и вариации не порождает.
        //
        // Исключение — значение с авторским идентификатором: он ставится только из
        // `variations[].id`, поэтому его наличие означает, что запись вариации в исходнике была,
        // пусть и пустая. Координата достраивается в [build], если к тому времени её так никто
        // и не завёл: у значения, под которым лежат записи `view`, билдер появится сам,
        // а ранняя вставка переставила бы порядок вариаций.
        //
        // Правило работает только потому, что импорт кладёт идентификатор на значение оси
        // лишь от записи без пересечений. Пока он брал первую попавшуюся, идентификаторы
        // координат оседали на значениях — 207 из 1219, — и та же достройка порождала
        // лишние вариации, ломая `BasicButton`, `IconButton` и `Loader`.
        if (value.properties.isEmpty() && targets.isEmpty()) {
            value.authoredId?.let { emptyWithAuthoredId[(axis to own).let(::listOf).canonical()] = it }
            return
        }

        if (axis == config.colorSchemeVariationId) {
            addSchemeValue(value, targets)
        } else {
            val key = targets.toCombination() + (axis to own)
            value.authoredId?.let { authoredIds[key.canonical()] = it }
            builderFor(key).props = value.properties
        }
    }

    fun build(): NativeConfig {
        // Пустые вариации исходника, которых не завело ни одно значение со свойствами.
        for ((key, authored) in emptyWithAuthoredId) {
            if (key !in builders) {
                authoredIds[key] = authored
                builderFor(key)
            }
        }

        // Вид оси нужен дважды: в объявлении `bindings` и в ссылках `binding[].value`,
        // где значение булевой оси обязано быть JSON-булем, а не строкой.
        // Объявленный тип имеет приоритет над выводом: роль оси и её тип независимы, и
        // `counter` в `sdds_sbcom` объявляет ось схемы как `enum`.
        val axisTypes = config.variations.associate { variation ->
            variation.id to (
                variation.declaredType
                    ?: bindingTypeOf(variation.id, axisValues.getValue(variation.id).toList())
                )
        }
        return NativeConfig(
            props = config.invariants,
            view = rootView,
            bindings = config.variations.map { variation ->
                val collected = axisValues.getValue(variation.id).toList()
                val type = axisTypes.getValue(variation.id)
                NativeBinding(
                    name = variation.name,
                    type = type,
                    // У булевой оси список значений не пишется вовсе: так устроены все 87 таких
                    // осей корпуса, и модель плагина принимает в `values` только строки —
                    // JSON-буль там она разобрать не может. Набор значений булевой оси и так
                    // известен из её вида.
                    values = if (type == BOOLEAN_BINDING_TYPE) null else collected,
                    defaultValue = defaults[variation.id]?.asAxisPrimitive(type),
                )
            },
            // Родитель выводится по множеству известных идентификаторов, поэтому оно
            // считается до сборки: самый длинный точечный префикс должен искаться среди
            // всех вариаций, а не только среди уже собранных.
            //
            // Идентификатор берётся по канонизированному ключу, а запасной вариант — по тому
            // порядку осей, в котором координата встретилась: ровно его билдер и пишет
            // в `binding`, поэтому иначе множество разошлось бы с выданными идентификаторами.
            variations = builders.entries.let { entries ->
                val idOf = { key: AxisCombination, builder: NativeVariationBuilder ->
                    authoredIds[key] ?: builder.key.derivedId()
                }
                val allIds = entries.map { (key, builder) -> idOf(key, builder) }.toSet()
                entries.map { (key, builder) -> builder.build(idOf(key, builder), allIds, axisTypes) }
            },
        )
    }

    private fun addSchemeValue(
        value: CommonVariationValue,
        targets: List<CommonTargetProperty>,
    ) {
        // Ключ записи и значение оси — разные величины, и обе восстанавливаются явно:
        // ключом служит авторский идентификатор, а значение уезжает в `binding` внутри записи.
        // Прежде ключом бралось имя значения — на `sdds_serv` это совпадало во всех 525
        // случаях, а на `sdds_sbcom` расходилось в 67 из 70.
        val schemeAxis = config.colorSchemeVariationId
        val entryKey = value.authoredId ?: value.name
        val entry = NativeViewEntry(
            props = value.properties,
            binding = schemeAxis?.let { axis ->
                listOf(
                    NativeBindingRef(
                        name = axisNames[axis] ?: axis,
                        value = JsonPrimitive(value.name),
                    ),
                )
            },
        )
        if (targets.isEmpty()) {
            rootView[entryKey] = entry
        } else {
            builderFor(targets.toCombination()).view[entryKey] = entry
        }
    }

    // Ключом служит канонизированная координата, а сам билдер помнит тот порядок осей,
    // в котором координата встретилась первой: он и уезжает в `binding` вариации.
    private fun builderFor(key: AxisCombination): NativeVariationBuilder =
        builders.getOrPut(key.canonical()) { NativeVariationBuilder(key, axisNames) }

    /**
     * Выводит вид оси из её роли и набора значений.
     *
     * Ось цветовой схемы объявлена ролью. Остальные различаются значениями: все 87
     * boolean-осей корпуса имеют ровно `{true, false}`, и ни одна enum-ось не содержит
     * `true` или `false` — пересечений ноль, поэтому набор значений вид определяет
     * однозначно.
     */
    private fun bindingTypeOf(axisId: String, values: List<JsonPrimitive>): String = when {
        axisId == config.colorSchemeVariationId -> COLOR_SCHEME_BINDING_TYPE
        // Достаточно, чтобы все значения были булевыми именами: ось, у которой используется
        // только `true`, всё равно булева. Требовать оба значения нельзя — конфигурации,
        // где встречается лишь одно, в корпусе есть.
        values.isNotEmpty() && values.all { it.content in BOOLEAN_AXIS_VALUES } -> BOOLEAN_BINDING_TYPE
        else -> ENUM_BINDING_TYPE
    }
}

/**
 * Накапливает одну native-вариацию.
 */
private class NativeVariationBuilder(
    val key: AxisCombination,
    private val axisNames: Map<String, String>,
) {
    var props: Map<String, NativeProperty> = emptyMap()

    val view: MutableMap<String, NativeViewEntry> = linkedMapOf()

    /**
     * Собирает вариацию, подставляя сохранённые идентификаторы.
     *
     * Если идентификатор не сохранён — конфигурация пришла не из native-формата, — он выводится
     * из значений осей. Тем же правилом выводится и `parent`: это идентификатор координаты
     * без последней оси.
     */
    fun build(
        id: String,
        allIds: Set<String>,
        axisTypes: Map<String, String>,
    ): NativeVariation {
        return NativeVariation(
            id = JsonPrimitive(id),
            parent = parentOf(id, allIds),
            binding = key.map { (axisId, value) ->
                NativeBindingRef(
                    name = axisNames[axisId] ?: axisId,
                    value = value.asAxisPrimitive(axisTypes[axisId] ?: ENUM_BINDING_TYPE),
                )
            },
            props = props,
            view = view,
        )
    }
}
