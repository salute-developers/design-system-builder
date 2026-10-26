package com.dsbuilder.frontend.feature.components.domain.codec

import kotlinx.serialization.json.Json

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
                    rootVariationId = rootAxisOf(axisNames, colorSchemeAxis),
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

internal fun <T, R> ConfigCodecResult<T>.flatMap(
    block: (T) -> ConfigCodecResult<R>,
): ConfigCodecResult<R> = when (this) {
    is ConfigCodecResult.Success -> block(value)
    is ConfigCodecResult.Failure -> this
}

internal fun <T, R> ConfigCodecResult<T>.map(
    block: (T) -> R,
): ConfigCodecResult<R> = flatMap { ConfigCodecResult.Success(block(it)) }
