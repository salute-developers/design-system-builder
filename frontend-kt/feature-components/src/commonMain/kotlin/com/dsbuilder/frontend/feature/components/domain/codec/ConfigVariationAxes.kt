package com.dsbuilder.frontend.feature.components.domain.codec

import kotlinx.serialization.json.JsonPrimitive

internal const val COLOR_SCHEME_BINDING_TYPE = "view"
internal const val ENUM_BINDING_TYPE = "enum"
internal const val BOOLEAN_BINDING_TYPE = "boolean"
internal const val FALLBACK_ROOT_AXIS = "size"

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
internal fun Map<String, List<CommonVariationValue>>.withDeclaredValues(
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
internal fun parentOf(id: String, allIds: Set<String>): String? {
    val parts = id.split(".")
    for (length in parts.size - 1 downTo 1) {
        val candidate = parts.take(length).joinToString(".")
        if (candidate in allIds) return candidate
    }
    return null
}

/**
 * Корневая ось конфигурации.
 *
 * Среди осей, кроме оси цветовой схемы, берётся ось `size`, иначе первая по порядку объявления.
 * Правило совпадает с тем, по которому сервис выбирает корень, когда конфигурация его не указала.
 * Если подходящих осей нет, корня нет.
 */
internal fun rootAxisOf(axisNames: List<String>, colorSchemeAxis: String?): String? {
    val candidates = axisNames.filter { it != colorSchemeAxis }
    return candidates.firstOrNull { it == FALLBACK_ROOT_AXIS } ?: candidates.firstOrNull()
}

/**
 * Тип оси по её роли и набору значений.
 *
 * Повторяет правило обратной сборки: ось цветовой схемы объявлена ролью, булева узнаётся по
 * значениям, остальные — перечисление.
 */
internal fun axisTypeOf(
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
internal fun NativeViewEntry.axisValueOf(axis: String, entryKey: String): String =
    binding.orEmpty().firstOrNull { it.name == axis }?.value?.content
        ?: binding.orEmpty().firstOrNull()?.value?.content
        ?: entryKey

internal fun List<NativeBindingRef>.toTargets(): List<CommonTarget>? = takeIf { it.isNotEmpty() }
    ?.let { references ->
        listOf(
            CommonTarget(properties = references.map { CommonTargetProperty(id = it.name, value = it.value) }),
        )
    }

internal fun List<CommonTargetProperty>.toCombination(): AxisCombination = map { it.id to it.value }

/** Идентификатор координаты, выведенный из значений осей: запасной путь. */
internal fun AxisCombination.derivedId(): String = joinToString(separator = ".") { it.second.content }

/**
 * Имена значений булевой оси.
 *
 * Вид оси выводится по ним, а не по объявленному типу: в корпусе ни одна enum-ось не содержит
 * `true` или `false`, пересечений ноль, поэтому имена определяют вид однозначно.
 */
internal val BOOLEAN_AXIS_VALUES = setOf("true", "false")

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
internal fun JsonPrimitive.asAxisPrimitive(bindingType: String): JsonPrimitive =
    if (bindingType == BOOLEAN_BINDING_TYPE) JsonPrimitive(content.toBooleanStrict()) else this

/**
 * Канонические примитивы значений осей, собранные по всей конфигурации.
 *
 * Common-формат именует значение строкой, тогда как native-формат хранит на осях типа `boolean`
 * настоящие JSON-були. Восстанавливать примитив из имени нельзя: `"false"` и `false` — разные
 * значения. Поэтому примитивы берутся оттуда, где они сохранились: из `defaults` и из `targets`.
 */
internal fun CommonConfig.canonicalAxisValues(): Map<Pair<String, String>, JsonPrimitive> = buildMap {
    defaults.forEach { put(it.id to it.value.content, it.value) }
    variations.forEach { variation ->
        variation.values.forEach { value ->
            value.targets.orEmpty().flatMap { it.properties }.forEach { put(it.id to it.value.content, it.value) }
        }
    }
}
