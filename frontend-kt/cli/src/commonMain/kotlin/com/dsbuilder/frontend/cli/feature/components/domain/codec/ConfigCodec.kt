package com.dsbuilder.frontend.cli.feature.components.domain.codec

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive

private const val COLOR_SCHEME_BINDING_TYPE = "view"
private const val ENUM_BINDING_TYPE = "enum"
private const val BOOLEAN_BINDING_TYPE = "boolean"

/**
 * Преобразует конфигурацию компонента между native и common форматами.
 *
 * Оси вариаций читаются из блока `bindings`. Разбор составных идентификаторов вариаций,
 * применявшийся в исходной реализации, не используется: он подставляет пустые значения вместо
 * отказа и тихо портит результат.
 */
internal class ConfigCodec(
    private val json: Json = defaultJson,
) {
    /**
     * Разбирает текст native-конфигурации и преобразует её в common-формат.
     */
    fun decode(nativeText: String): ConfigCodecResult<CommonConfig> =
        parse { json.decodeFromString(NativeConfig.serializer(), nativeText) }.flatMap(::decode)

    /**
     * Преобразует native-конфигурацию в common-формат.
     */
    fun decode(config: NativeConfig): ConfigCodecResult<CommonConfig> {
        val bindings = config.bindings.orEmpty()
        if (config.variations.isNotEmpty() && bindings.isEmpty()) {
            return ConfigCodecResult.Failure(ConfigCodecFailure.MissingBindings(config.variations.size))
        }

        val colorSchemeAxis = config.resolveColorSchemeAxis()
        val axisNames = buildList {
            addAll(bindings.map { it.name })
            if (colorSchemeAxis != null && colorSchemeAxis !in this) {
                add(colorSchemeAxis)
            }
        }

        return collectAxisValues(config, axisNames, colorSchemeAxis)
            .map { values -> values.withDeclaredValues(bindings) }
            .map { values ->
                CommonConfig(
                    rootVariationId = axisNames.firstOrNull(),
                    colorSchemeVariationId = colorSchemeAxis,
                    invariants = config.props,
                    defaults = bindings.mapNotNull { binding ->
                        binding.defaultValue?.let { CommonDefault(id = binding.name, value = it) }
                    },
                    variations = axisNames.map { axis ->
                        CommonVariation(
                            id = axis,
                            name = axis,
                            values = values.getValue(axis),
                            // Тип берётся из объявления, а при его отсутствии выводится тем же
                            // правилом, каким его выведет обратная сборка: поле означает тип оси
                            // в native-форме, и круг обязан оставаться точным.
                            declaredType = bindings.firstOrNull { it.name == axis }?.type
                                ?: axisTypeOf(axis, colorSchemeAxis, values.getValue(axis)),
                        )
                    },
                )
            }
    }

    /**
     * Разбирает текст common-конфигурации и преобразует её в native-формат.
     */
    fun encodeFromText(commonText: String): ConfigCodecResult<NativeConfig> =
        parse { json.decodeFromString(CommonConfig.serializer(), commonText) }.flatMap(::encode)

    /**
     * Преобразует common-конфигурацию в native-формат.
     */
    fun encode(config: CommonConfig): ConfigCodecResult<NativeConfig> {
        val declared = config.variations.map { it.id }.toSet()
        val undeclared = config.variations
            .flatMap { variation -> variation.values }
            .flatMap { value -> value.targets.orEmpty() }
            .flatMap { target -> target.properties }
            .firstOrNull { it.id !in declared }
        if (undeclared != null) {
            return ConfigCodecResult.Failure(ConfigCodecFailure.UnknownCommonAxis(undeclared.id))
        }

        val accumulator = NativeAccumulator(config)
        config.variations.forEach { variation ->
            variation.values.forEach { value -> accumulator.add(variation.id, value) }
        }

        val native = accumulator.build()

        // Постусловие вывода родителя: составной идентификатор без найденного родителя означает,
        // что вариация молча уехала бы в корень дерева наследования. Проверяется здесь, а не
        // внутри сборки, чтобы отказ шёл через тип результата, а не исключением.
        val orphan = native.variations.firstOrNull { variation ->
            val id = variation.id?.content.orEmpty()
            id.contains('.') && variation.parent == null
        }
        if (orphan != null) {
            return ConfigCodecResult.Failure(
                ConfigCodecFailure.UnresolvedVariationParent(orphan.id?.content.orEmpty()),
            )
        }

        return ConfigCodecResult.Success(native)
    }

    /**
     * Собирает значения каждой оси из корневых `view`, вариаций и их `view`.
     *
     * Ранние возвраты здесь и есть содержание функции: каждая ветвь отклоняет конфигурацию с
     * конкретной диагностикой, и сведение их к одному выходу только скрыло бы причину отказа.
     */
    @Suppress("ReturnCount")
    private fun collectAxisValues(
        config: NativeConfig,
        axisNames: List<String>,
        colorSchemeAxis: String?,
    ): ConfigCodecResult<Map<String, List<CommonVariationValue>>> {
        val values = axisNames.associateWith { mutableListOf<CommonVariationValue>() }

        config.view.forEach { (entryKey, entry) ->
            val axis = colorSchemeAxis ?: return ConfigCodecResult.Failure(
                ConfigCodecFailure.UnknownAxis(COLOR_SCHEME_BINDING_TYPE, axisNames),
            )
            values.getValue(axis) += CommonVariationValue(
                name = entry.axisValueOf(axis, entryKey),
                properties = entry.props,
                authoredId = entryKey,
            )
        }

        config.variations.forEach { variation ->
            val binding = variation.binding.orEmpty()
            validate(variation, binding, values.keys)?.let { return ConfigCodecResult.Failure(it) }

            values.getValue(binding.last().name) += CommonVariationValue(
                name = binding.last().value.content,
                targets = binding.dropLast(1).toTargets(),
                properties = variation.props,
                authoredId = variation.id?.content,
            )

            variation.view.forEach { (entryKey, entry) ->
                val axis = colorSchemeAxis
                    ?: return ConfigCodecResult.Failure(
                        ConfigCodecFailure.UnknownAxis(COLOR_SCHEME_BINDING_TYPE, axisNames),
                    )
                values.getValue(axis) += CommonVariationValue(
                    name = entry.axisValueOf(axis, entryKey),
                    targets = binding.toTargets(),
                    properties = entry.props,
                    authoredId = entryKey,
                )
            }
        }

        return ConfigCodecResult.Success(values)
    }

    /**
     * Проверяет одну вариацию и возвращает причину отказа либо `null`.
     */
    private fun validate(
        variation: NativeVariation,
        binding: List<NativeBindingRef>,
        declaredAxes: Set<String>,
    ): ConfigCodecFailure? {
        val id = variation.id?.content.orEmpty()
        if (binding.isEmpty()) {
            return ConfigCodecFailure.MissingVariationBinding(id)
        }

        val ownAxis = binding.last().name
        if (variation.key != null && variation.key != ownAxis) {
            return ConfigCodecFailure.KeyBindingMismatch(id, variation.key, ownAxis)
        }

        val unknown = binding.firstOrNull { it.name !in declaredAxes }
        return unknown?.let { ConfigCodecFailure.UnknownAxis(it.name, declaredAxes.toList()) }
    }

    private fun <T> parse(block: () -> T): ConfigCodecResult<T> = try {
        ConfigCodecResult.Success(block())
    } catch (exception: IllegalArgumentException) {
        ConfigCodecResult.Failure(ConfigCodecFailure.Unparsable(exception.message ?: "unexpected shape"))
    }

    private companion object {
        val defaultJson: Json = Json {
            ignoreUnknownKeys = true
            encodeDefaults = false
            explicitNulls = false
        }
    }
}

/**
 * Дополняет значения осей объявленными, но неиспользованными, и выстраивает их в объявленном
 * порядке.
 *
 * `bindings[].values` перечисляет всё, что ось открывает наружу, тогда как вариации несут лишь
 * те значения, которым что-то переопределено. В корпусе 81 ось из 821 объявляет значения, не
 * встречающиеся ни в одной вариации, а 21 ось не использует ни одного своего значения:
 * `plasma_b2c/badge-clear` объявляет `shape: [default, pilled]`, а переопределения несёт только
 * `pilled` — форма для `default` задана внутри вариаций `size`. Потерять такое значение значит
 * убрать `shape=default` из API компонента.
 *
 * Значения, которые вариации используют, остаются в своём порядке — он приходит из порядка
 * вариаций. Неиспользованные добавляются следом, в порядке объявления: восстановить их место
 * среди используемых неоткуда, а сам порядок объявления — часть контракта оси.
 */
private fun Map<String, List<CommonVariationValue>>.withDeclaredValues(
    bindings: List<NativeBinding>,
): Map<String, List<CommonVariationValue>> {
    val declaredByAxis = bindings.associate { binding -> binding.name to binding.values.orEmpty() }

    return mapValues { (axis, collected) ->
        val declared = declaredByAxis[axis].orEmpty()
        if (declared.isEmpty()) {
            return@mapValues collected
        }

        // Порядок объявления восстанавливается только для собственных значений оси — тех,
        // что не несут пересечений. Записи с `targets` остаются на своих местах: одно имя
        // встречается в них по разу на каждое пересечение, и сортировка по имени склеила бы
        // эти вхождения, переставив вариации местами.
        val ownByName = collected.filter { it.targets.isNullOrEmpty() }.groupBy { it.name }
        val crossAxis = collected.filter { !it.targets.isNullOrEmpty() }

        // Объявленные значения идут в объявленном порядке, и неиспользованное встаёт на своё
        // место, а не в конец: `plasma_homeds/avatar` объявляет `shape: [default, pilled]`,
        // а переопределения несёт только `pilled`.
        // Пустая запись заводится только для значения, которого нет нигде: имя, встречающееся
        // среди пересечений, уже присутствует в оси, и вторая запись была бы дублем.
        val collectedNames = collected.map { it.name }.toSet()
        val ownDeclared = declared.flatMap { primitive ->
            ownByName[primitive.content]
                ?: listOfNotNull(
                    CommonVariationValue(name = primitive.content).takeIf { primitive.content !in collectedNames },
                )
        }
        val declaredNames = declared.map { it.content }.toSet()
        val ownUndeclared = ownByName.filterKeys { it !in declaredNames }.values.flatten()

        ownDeclared + ownUndeclared + crossAxis
    }
}

/**
 * Определяет ось, играющую роль цветовой схемы.
 *
 * Правило трёхступенчатое, потому что данные неоднородны. Ось объявлена типом `view` у 152
 * конфигураций корпуса. У 52 такого объявления нет, и имя оси несёт `binding` внутри записи
 * `view`, причём у 42 из них эта ось вообще отсутствует в `bindings`. У трёх конфигураций
 * записи `view` есть, а имени оси взять неоткуда, и тогда применяется имя `view` по умолчанию.
 */
internal fun NativeConfig.resolveColorSchemeAxis(): String? {
    bindings.orEmpty().firstOrNull { it.type == COLOR_SCHEME_BINDING_TYPE }?.let { return it.name }

    val entries = view.values + variations.flatMap { it.view.values }
    if (entries.isEmpty()) {
        return null
    }
    return entries.firstNotNullOfOrNull { entry -> entry.binding?.firstOrNull()?.name }
        ?: COLOR_SCHEME_BINDING_TYPE
}

/**
 * Сочетание значений осей, однозначно задающее одну native-вариацию.
 */
private typealias AxisCombination = List<Pair<String, JsonPrimitive>>

/**
 * Накапливает native-конфигурацию, собираемую из значений common-формата.
 */
private class NativeAccumulator(
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

/**
 * Родитель вариации: самый длинный точечный префикс её идентификатора, принадлежащий другой
 * вариации той же конфигурации.
 *
 * Выводится, а не хранится: правило точно на 1219 вариациях из 1219 двух корпусов. Прежде
 * родитель хранился рядом с идентификатором, потому что проверялся вывод **из координаты** —
 * оттуда его действительно не вывести, у `basic_button` в `sdds_sbcom` есть вариация с двумя
 * осями и `parent: null`. Вывод из самого идентификатора тогда проверен не был.
 *
 * Префикс ищется среди существующих идентификаторов, а не отрезается механически: в корпусе
 * есть вариации с пропущенным звеном, и отрезание последнего сегмента дало бы ссылку в пустоту.
 */
private fun parentOf(id: String, allIds: Set<String>): String? {
    val parts = id.split(".")
    for (length in parts.size - 1 downTo 1) {
        val candidate = parts.take(length).joinToString(".")
        if (candidate in allIds) return candidate
    }
    return null
}

/**
 * Тип оси по её роли и набору значений.
 *
 * Повторяет правило обратной сборки: ось цветовой схемы объявлена ролью, булева узнаётся по
 * значениям, остальные — перечисление.
 */
private fun axisTypeOf(
    axis: String,
    colorSchemeAxis: String?,
    values: List<CommonVariationValue>,
): String = when {
    axis == colorSchemeAxis -> COLOR_SCHEME_BINDING_TYPE
    values.isNotEmpty() && values.all { it.name in BOOLEAN_AXIS_VALUES } -> BOOLEAN_BINDING_TYPE
    else -> ENUM_BINDING_TYPE
}

/**
 * Значение оси, которое обозначает запись `view`.
 *
 * Ключ карты и значение оси — разные величины: в `sdds_sbcom` ключ `state-accent` стоит при
 * значении `accent`, и совпадают они лишь в 3 случаях из 70. Авторитетен `binding` внутри
 * записи; ключ остаётся подписью и уезжает в `authoredId`.
 *
 * Записи без `binding` в корпусе есть (две в `badge_config.json`), и там ключ и значение
 * совпадают по построению — ось объявлена с ровно такими значениями. Для них ключ и берётся.
 */
private fun NativeViewEntry.axisValueOf(axis: String, entryKey: String): String =
    binding.orEmpty().firstOrNull { it.name == axis }?.value?.content
        ?: binding.orEmpty().firstOrNull()?.value?.content
        ?: entryKey

private fun List<NativeBindingRef>.toTargets(): List<CommonTarget>? = takeIf { it.isNotEmpty() }
    ?.let { references ->
        listOf(
            CommonTarget(properties = references.map { CommonTargetProperty(id = it.name, value = it.value) }),
        )
    }

private fun List<CommonTargetProperty>.toCombination(): AxisCombination = map { it.id to it.value }

/** Идентификатор координаты, выведенный из значений осей: запасной путь. */
private fun AxisCombination.derivedId(): String = joinToString(separator = ".") { it.second.content }

/**
 * Имена значений булевой оси.
 *
 * Вид оси выводится по ним, а не по объявленному типу: в корпусе ни одна enum-ось не содержит
 * `true` или `false`, пересечений ноль, поэтому имена определяют вид однозначно.
 */
private val BOOLEAN_AXIS_VALUES = setOf("true", "false")

/**
 * Приводит значение оси к примитиву, которого требует её вид.
 *
 * Общий формат именует значение строкой, поэтому примитив теряется у любого значения, которое
 * не встретилось ни в `defaults`, ни в `targets`. Восстанавливать примитив по имени можно только
 * зная вид оси: у boolean-оси `"true"` означает `true`, у enum-оси — строку `"true"`.
 *
 * Применяется к `defaultValue` и к ссылкам в `binding`, но не к `bindings[].values`: там модель
 * плагина ждёт строки.
 */
private fun JsonPrimitive.asAxisPrimitive(bindingType: String): JsonPrimitive =
    if (bindingType == BOOLEAN_BINDING_TYPE) JsonPrimitive(content.toBooleanStrict()) else this

/**
 * Канонические примитивы значений осей, собранные по всей конфигурации.
 *
 * Common-формат именует значение строкой, тогда как native-формат хранит на осях типа `boolean`
 * настоящие JSON-були. Восстанавливать примитив из имени нельзя: `"false"` и `false` — разные
 * значения. Поэтому примитивы берутся оттуда, где они сохранились: из `defaults` и из `targets`.
 */
private fun CommonConfig.canonicalAxisValues(): Map<Pair<String, String>, JsonPrimitive> = buildMap {
    defaults.forEach { put(it.id to it.value.content, it.value) }
    variations.forEach { variation ->
        variation.values.forEach { value ->
            value.targets.orEmpty().flatMap { it.properties }.forEach { put(it.id to it.value.content, it.value) }
        }
    }
}

private fun <T, R> ConfigCodecResult<T>.flatMap(
    block: (T) -> ConfigCodecResult<R>,
): ConfigCodecResult<R> = when (this) {
    is ConfigCodecResult.Success -> block(value)
    is ConfigCodecResult.Failure -> this
}

private fun <T, R> ConfigCodecResult<T>.map(
    block: (T) -> R,
): ConfigCodecResult<R> = flatMap { ConfigCodecResult.Success(block(it)) }
