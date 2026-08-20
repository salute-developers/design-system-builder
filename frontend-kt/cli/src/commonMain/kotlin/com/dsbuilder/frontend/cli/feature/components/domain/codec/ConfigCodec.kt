package com.dsbuilder.frontend.cli.feature.components.domain.codec

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive

private const val COLOR_SCHEME_BINDING_TYPE = "view"
private const val ENUM_BINDING_TYPE = "enum"

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

        return collectAxisValues(config, axisNames, colorSchemeAxis).map { values ->
            CommonConfig(
                rootVariationId = axisNames.firstOrNull(),
                colorSchemeVariationId = colorSchemeAxis,
                invariants = config.props,
                defaults = bindings.mapNotNull { binding ->
                    binding.defaultValue?.let { CommonDefault(id = binding.name, value = it) }
                },
                variations = axisNames.map { axis ->
                    CommonVariation(id = axis, name = axis, values = values.getValue(axis))
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

        return ConfigCodecResult.Success(accumulator.build())
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

        config.view.forEach { (valueName, entry) ->
            val axis = colorSchemeAxis ?: return ConfigCodecResult.Failure(
                ConfigCodecFailure.UnknownAxis(COLOR_SCHEME_BINDING_TYPE, axisNames),
            )
            values.getValue(axis) += CommonVariationValue(name = valueName, properties = entry.props)
        }

        config.variations.forEach { variation ->
            val binding = variation.binding.orEmpty()
            validate(variation, binding, values.keys)?.let { return ConfigCodecResult.Failure(it) }

            values.getValue(binding.last().name) += CommonVariationValue(
                name = binding.last().value.content,
                targets = binding.dropLast(1).toTargets(),
                properties = variation.props,
            )

            variation.view.forEach { (valueName, entry) ->
                val axis = colorSchemeAxis
                    ?: return ConfigCodecResult.Failure(
                        ConfigCodecFailure.UnknownAxis(COLOR_SCHEME_BINDING_TYPE, axisNames),
                    )
                values.getValue(axis) += CommonVariationValue(
                    name = valueName,
                    targets = binding.toTargets(),
                    properties = entry.props,
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
    private val defaults = config.defaults.associate { it.id to it.value }
    private val rootView = linkedMapOf<String, NativeViewEntry>()
    private val builders = linkedMapOf<AxisCombination, NativeVariationBuilder>()
    private val axisValues = config.variations.associate { it.id to linkedSetOf<JsonPrimitive>() }

    fun add(axis: String, value: CommonVariationValue) {
        val targets = value.targets.orEmpty().flatMap { it.properties }
        targets.forEach { axisValues.getValue(it.id) += it.value }

        val own = canonical[axis to value.name] ?: JsonPrimitive(value.name)
        axisValues.getValue(axis) += own

        if (axis == config.colorSchemeVariationId) {
            addSchemeValue(value, targets)
        } else {
            builderFor(targets.toCombination() + (axis to own)).props = value.properties
        }
    }

    fun build(): NativeConfig = NativeConfig(
        props = config.invariants,
        view = rootView,
        bindings = config.variations.map { variation ->
            NativeBinding(
                name = variation.id,
                type = if (variation.id == config.colorSchemeVariationId) {
                    COLOR_SCHEME_BINDING_TYPE
                } else {
                    ENUM_BINDING_TYPE
                },
                values = axisValues.getValue(variation.id).toList(),
                defaultValue = defaults[variation.id],
            )
        },
        variations = builders.values.map { it.build() },
    )

    private fun addSchemeValue(
        value: CommonVariationValue,
        targets: List<CommonTargetProperty>,
    ) {
        val entry = NativeViewEntry(props = value.properties)
        if (targets.isEmpty()) {
            rootView[value.name] = entry
        } else {
            builderFor(targets.toCombination()).view[value.name] = entry
        }
    }

    private fun builderFor(key: AxisCombination): NativeVariationBuilder =
        builders.getOrPut(key) { NativeVariationBuilder(key) }
}

/**
 * Накапливает одну native-вариацию.
 */
private class NativeVariationBuilder(
    private val key: AxisCombination,
) {
    var props: Map<String, NativeProperty> = emptyMap()

    val view: MutableMap<String, NativeViewEntry> = linkedMapOf()

    fun build(): NativeVariation = NativeVariation(
        id = JsonPrimitive(key.joinToString(separator = ".") { it.second.content }),
        parent = key.dropLast(1)
            .takeIf { it.isNotEmpty() }
            ?.joinToString(separator = ".") { it.second.content },
        binding = key.map { NativeBindingRef(name = it.first, value = it.second) },
        props = props,
        view = view,
    )
}

private fun List<NativeBindingRef>.toTargets(): List<CommonTarget>? = takeIf { it.isNotEmpty() }
    ?.let { references ->
        listOf(
            CommonTarget(properties = references.map { CommonTargetProperty(id = it.name, value = it.value) }),
        )
    }

private fun List<CommonTargetProperty>.toCombination(): AxisCombination = map { it.id to it.value }

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
