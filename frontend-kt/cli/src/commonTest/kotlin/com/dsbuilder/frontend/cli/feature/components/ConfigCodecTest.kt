package com.dsbuilder.frontend.cli.feature.components

import com.dsbuilder.frontend.cli.feature.components.domain.codec.CommonConfig
import com.dsbuilder.frontend.cli.feature.components.domain.codec.CommonDefault
import com.dsbuilder.frontend.cli.feature.components.domain.codec.CommonVariation
import com.dsbuilder.frontend.cli.feature.components.domain.codec.CommonVariationValue
import com.dsbuilder.frontend.cli.feature.components.domain.codec.ConfigCodec
import com.dsbuilder.frontend.cli.feature.components.domain.codec.ConfigCodecFailure
import com.dsbuilder.frontend.cli.feature.components.domain.codec.ConfigCodecResult
import com.dsbuilder.frontend.cli.feature.components.domain.codec.NativeConfig
import com.dsbuilder.frontend.cli.feature.components.domain.codec.NativeProperty
import com.dsbuilder.frontend.cli.feature.components.domain.codec.resolveColorSchemeAxis
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

class ConfigCodecTest {
    private val codec = ConfigCodec()

    /**
     * Конфигурации, которые codec принимает. Исключена одна запись корпуса с опечаткой в поле
     * `key`: она проверяется отдельно тестом [decodeRejectsRealWorldKeyTypo].
     */
    private val decodableEntries = NativeConfigCorpus.entries.filterNot { entry ->
        entry.designSystem == "plasma_homeds" && entry.fileName == "card_config.json"
    }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
        explicitNulls = false
    }

    @Test
    fun corpusDeserializesWithoutLoss() {
        NativeConfigCorpus.entries.forEach { entry ->
            val config = json.decodeFromString(NativeConfig.serializer(), entry.json)
            val reserialized = json.encodeToString(NativeConfig.serializer(), config)
            val again = json.decodeFromString(NativeConfig.serializer(), reserialized)

            assertEquals(config, again, "${entry.designSystem}/${entry.fileName} не переживает пересериализацию")
        }
    }

    @Test
    fun bindingsSurviveDeserialization() {
        val withAxes = NativeConfigCorpus.entries.filter { entry ->
            json.decodeFromString(NativeConfig.serializer(), entry.json).variations.isNotEmpty()
        }

        assertTrue(withAxes.isNotEmpty(), "в корпусе нет конфигураций с вариациями")
        withAxes.forEach { entry ->
            val config = json.decodeFromString(NativeConfig.serializer(), entry.json)
            val bindings = config.bindings

            assertNotNull(bindings, "${entry.fileName}: поле bindings потеряно")
            assertTrue(bindings.isNotEmpty(), "${entry.fileName}: bindings пуст при непустых variations")
            assertTrue(
                bindings.all { it.name.isNotBlank() },
                "${entry.fileName}: у оси потеряно имя",
            )
        }
    }

    @Test
    fun decodeReadsAxesFromBindings() {
        val common = decodeOrFail(NativeConfigCorpus.plasmaB2cDrawerCloseNone)

        assertEquals(listOf("size", "has-shadow"), common.variations.map { it.id })
        assertEquals("size", common.rootVariationId)
        assertNull(common.colorSchemeVariationId, "конфигурация не объявляет цветовую схему")
    }

    @Test
    fun decodeTakesColorSchemeFromBindingType() {
        val common = decodeOrFail(NativeConfigCorpus.plasmaB2cProgressBar)

        assertEquals("view", common.colorSchemeVariationId)
        assertEquals(listOf("view"), common.variations.map { it.id })
    }

    @Test
    fun decodeTakesColorSchemeFromViewBindingWhenTypeIsAbsent() {
        val common = decodeOrFail(NativeConfigCorpus.sddsSbcomBasicButton)

        assertEquals("mode", common.colorSchemeVariationId)
        assertTrue(
            common.variations.single { it.id == "mode" }.values.isNotEmpty(),
            "значения цветовой схемы потеряны",
        )
    }

    @Test
    fun decodeCarriesBindingDefaultsIntoDefaults() {
        val native = json.decodeFromString(NativeConfig.serializer(), NativeConfigCorpus.plasmaHomedsList)
        val common = decodeOrFail(NativeConfigCorpus.plasmaHomedsList)

        val expected = native.bindings.orEmpty().mapNotNull { binding ->
            binding.defaultValue?.let { binding.name to it.content }
        }

        assertEquals(expected, common.defaults.map { it.id to it.value.content })
        assertTrue(expected.isNotEmpty(), "в конфигурации нет дефолтов, тест бесполезен")
    }

    @Test
    fun decodeMapsLastBindingEntryToOwnAxisAndPrecedingToTargets() {
        val common = decodeOrFail(NativeConfigCorpus.plasmaB2cDrawerCloseNone)
        val owner = common.variations.first { variation -> variation.values.any { it.targets != null } }
        val nested = owner.values.first { it.targets != null }

        val targets = assertNotNull(nested.targets, "вложенное значение потеряло targets")
        val properties = targets.single().properties

        assertTrue(properties.isNotEmpty(), "target не содержит ссылок на оси")
        assertTrue(properties.none { it.id == owner.id }, "собственная ось попала в targets")
    }

    @Test
    fun decodeLeavesFlatValueWithoutTargets() {
        val common = decodeOrFail(NativeConfigCorpus.plasmaB2cAvatarGroup)
        val size = common.variations.single { it.id == "size" }

        assertEquals(1, size.values.size)
        assertNull(size.values.single().targets)
    }

    @Test
    fun decodeMapsRootViewWithoutTargetsAndVariationViewWithTargets() {
        val common = decodeOrFail(NativeConfigCorpus.sddsSbcomBasicButton)
        val scheme = assertNotNull(common.colorSchemeVariationId, "цветовая схема не определена")
        val values = common.variations.single { it.id == scheme }.values

        assertTrue(values.any { it.targets == null }, "нет значений цветовой схемы без targets")
        assertTrue(values.any { it.targets != null }, "нет значений цветовой схемы с targets")
    }

    @Test
    fun decodeCarriesInvariants() {
        val native = json.decodeFromString(NativeConfig.serializer(), NativeConfigCorpus.plasmaStardsDivider)
        val common = decodeOrFail(NativeConfigCorpus.plasmaStardsDivider)

        assertEquals(native.props, common.invariants)
        assertTrue(common.invariants.isNotEmpty(), "в конфигурации нет инвариантов, тест бесполезен")
    }

    @Test
    fun decodeAcceptsConfigurationWithoutVariationsAndBindings() {
        val common = decodeOrFail(NativeConfigCorpus.plasmaHomedsRectSkeleton)

        assertTrue(common.variations.isEmpty())
        assertTrue(common.invariants.isNotEmpty())
        assertNull(common.rootVariationId)
        assertNull(common.colorSchemeVariationId)
    }

    @Test
    fun decodeRejectsVariationsWithoutBindings() {
        val text = """
            {"props":{},"view":{},"variations":[{"id":"m","binding":[{"name":"size","value":"m"}],"props":{}}]}
        """.trimIndent()

        val failure = failureOf(text)

        assertTrue(failure is ConfigCodecFailure.MissingBindings, "получено: $failure")
        assertTrue(failure.message.contains("no bindings"))
    }

    @Test
    fun decodeRejectsVariationWithoutBinding() {
        val text = """
            {"props":{},"view":{},"bindings":[{"name":"size","type":"enum","defaultValue":"m"}],
            "variations":[{"id":"m","props":{}}]}
        """.trimIndent()

        val failure = failureOf(text)

        assertTrue(failure is ConfigCodecFailure.MissingVariationBinding, "получено: $failure")
        assertTrue(failure.message.contains("'m'"))
    }

    @Test
    fun decodeRejectsKeyThatDisagreesWithBinding() {
        val text = """
            {"props":{},"view":{},"bindings":[{"name":"size","type":"enum","defaultValue":"m"}],
            "variations":[{"id":"m","key":"shape","binding":[{"name":"size","value":"m"}],"props":{}}]}
        """.trimIndent()

        val failure = failureOf(text)

        assertTrue(failure is ConfigCodecFailure.KeyBindingMismatch, "получено: $failure")
        assertTrue(failure.message.contains("shape") && failure.message.contains("size"))
    }

    @Test
    fun decodeAcceptsKeyThatAgreesWithBinding() {
        val common = decodeOrFail(NativeConfigCorpus.plasmaHomedsAvatar)

        assertTrue(common.variations.isNotEmpty())
    }

    /**
     * Правило сверки `key` отвергает единственную конфигурацию корпуса, и это дефект исходных
     * данных, а не теста: `plasma_homeds/card_config.json` объявляет `key` в единственном числе
     * при оси во множественном. На все 500 конфигураций живых дизайн-систем расхождение одно.
     */
    @Test
    fun decodeRejectsRealWorldKeyTypo() {
        val failure = failureOf(NativeConfigCorpus.plasmaHomedsCard)

        assertTrue(failure is ConfigCodecFailure.KeyBindingMismatch, "получено: $failure")
        assertTrue(failure.message.contains("has-inner-padding"), failure.message)
        assertTrue(failure.message.contains("has-inner-paddings"), failure.message)
    }

    @Test
    fun commonRoundTripIsExact() {
        decodableEntries.forEach { entry ->
            val common = decodeOrFail(entry.json)
            val native = when (val result = codec.encode(common)) {
                is ConfigCodecResult.Success -> result.value
                is ConfigCodecResult.Failure -> fail("${entry.fileName}: encode отказал — ${result.reason.message}")
            }
            val again = when (val result = codec.decode(native)) {
                is ConfigCodecResult.Success -> result.value
                is ConfigCodecResult.Failure -> fail("${entry.fileName}: decode отказал — ${result.reason.message}")
            }

            assertEquals(common, again, "${entry.designSystem}/${entry.fileName}: common -> native -> common неточен")
        }
    }

    @Test
    fun nativeRoundTripPreservesExpressiblePart() {
        decodableEntries.forEach { entry ->
            val original = json.decodeFromString(NativeConfig.serializer(), entry.json)
            val common = decodeOrFail(entry.json)
            val restored = when (val result = codec.encode(common)) {
                is ConfigCodecResult.Success -> result.value
                is ConfigCodecResult.Failure -> fail("${entry.fileName}: encode отказал — ${result.reason.message}")
            }
            val label = "${entry.designSystem}/${entry.fileName}"

            assertEquals(original.axes(), restored.axes(), "$label: оси или их порядок изменились")
            assertEquals(original.axisDefaults(), restored.axisDefaults(), "$label: дефолты осей изменились")
            assertEquals(original.usedAxisValues(), restored.usedAxisValues(), "$label: значения осей изменились")
            assertEquals(original.props, restored.props, "$label: инварианты изменились")
            assertEquals(
                original.propertiesByCombination(),
                restored.propertiesByCombination(),
                "$label: свойства сочетаний изменились",
            )
            // Идентификатор вариации авторский, и плагин строит из него имя генерируемого
            // стиля: подмена `m.has-shadow` на `m.true` переименовывает публичный стиль темы.
            assertEquals(
                original.variationIds(),
                restored.variationIds(),
                "$label: идентификаторы вариаций изменились",
            )
            // Сверяются только оси, у которых список объявлен в исходнике: там, где его нет,
            // восстановленная конфигурация список заполняет, и это пополнение, а не потеря.
            // Сверяется сохранность объявленного, а не совпадение списков целиком: у части
            // конфигураций корпуса значения, встречающиеся в вариациях, объявлением не покрыты
            // (`sdds_sbcom/checkbox` объявляет `variant: [default, poll]`, а вариации носят
            // `variant-default` и `variant-poll`), и восстановленный список их добирает.
            // Требуется, чтобы всё объявленное осталось и осталось в том же порядке.
            val declared = original.declaredAxisValues()
            val restoredDeclared = restored.declaredAxisValues()
            declared.forEach { (axis, values) ->
                assertEquals(
                    values,
                    restoredDeclared[axis].orEmpty().filter { it in values },
                    "$label: объявленные значения оси $axis или их порядок изменились",
                )
            }
            // Сверяются только оси, объявленные в исходнике: у 42 конфигураций корпуса ось
            // цветовой схемы в `bindings` отсутствует и выводится из записей `view`,
            // а восстановленная конфигурация её объявляет — это пополнение, а не потеря.
            // Ось цветовой схемы из сверки исключается: общий формат несёт её роль, а не
            // объявленный вид, и восстановить `enum` для оси, которая эту роль исполняет,
            // неоткуда. `sdds_sbcom/checkbox` объявляет `variant` как `enum` и хранит в нём
            // записи `view`.
            val scheme = original.colorSchemeAxis()
            val types = original.axisTypes().filterKeys { it != scheme }
            assertEquals(
                types,
                restored.axisTypes().filterKeys { it in types.keys },
                "$label: виды осей изменились",
            )
            val booleanAxes = original.booleanAxisPrimitives()
            assertEquals(
                booleanAxes,
                restored.booleanAxisPrimitives().filterKeys { it in booleanAxes.keys },
                "$label: значения boolean-осей перестали быть JSON-булями",
            )
        }
    }

    @Test
    fun encodeWritesAxisNameNotIdentifier() {
        // Общий формат различает идентификатор оси и её имя; native знает только имя.
        val common = CommonConfig(
            rootVariationId = "8b0f0b1e-0000-4000-8000-000000000001",
            colorSchemeVariationId = null,
            invariants = emptyMap(),
            defaults = listOf(CommonDefault(id = "8b0f0b1e-0000-4000-8000-000000000001", value = JsonPrimitive("m"))),
            variations = listOf(
                CommonVariation(
                    id = "8b0f0b1e-0000-4000-8000-000000000001",
                    name = "size",
                    values = listOf(
                        CommonVariationValue(
                            name = "m",
                            properties = mapOf("gap" to NativeProperty(type = "dimension", value = JsonPrimitive(8))),
                        ),
                    ),
                ),
            ),
        )

        val native = when (val result = codec.encode(common)) {
            is ConfigCodecResult.Success -> result.value
            is ConfigCodecResult.Failure -> fail("encode отказал — ${result.reason.message}")
        }

        // Без этого в собранную тему уехал бы uuid вместо имени оси.
        assertEquals(listOf("size"), native.bindings.orEmpty().map { it.name })
        assertEquals(listOf("size"), native.variations.single().binding.orEmpty().map { it.name })
    }

    @Test
    fun encodeKeepsDeclaredValueWithoutOverridesOutOfVariations() {
        val common = CommonConfig(
            rootVariationId = "shape",
            colorSchemeVariationId = null,
            invariants = emptyMap(),
            defaults = listOf(CommonDefault(id = "shape", value = JsonPrimitive("default"))),
            variations = listOf(
                CommonVariation(
                    id = "shape",
                    name = "shape",
                    values = listOf(
                        // Значение объявлено осью, но ничего не переопределяет.
                        CommonVariationValue(name = "default"),
                        CommonVariationValue(
                            name = "pilled",
                            properties = mapOf(
                                "shape" to NativeProperty(type = "shape", value = JsonPrimitive("round.circle")),
                            ),
                        ),
                    ),
                ),
            ),
        )

        val native = when (val result = codec.encode(common)) {
            is ConfigCodecResult.Success -> result.value
            is ConfigCodecResult.Failure -> fail("encode отказал — ${result.reason.message}")
        }

        assertEquals(
            listOf("default", "pilled"),
            native.bindings.orEmpty().single().values.orEmpty().map { it.content },
        )
        // Пустая вариация означала бы сочетание без единого свойства — это другое.
        assertEquals(listOf("pilled"), native.variations.map { it.binding.orEmpty().single().value.content })
    }

    @Test
    fun encodeDerivesBooleanAxisType() {
        val common = CommonConfig(
            rootVariationId = "has-shadow",
            colorSchemeVariationId = null,
            invariants = emptyMap(),
            defaults = listOf(CommonDefault(id = "has-shadow", value = JsonPrimitive(false))),
            variations = listOf(
                CommonVariation(
                    id = "has-shadow",
                    name = "has-shadow",
                    values = listOf(
                        CommonVariationValue(name = "false"),
                        CommonVariationValue(
                            name = "true",
                            properties = mapOf(
                                "shadow" to NativeProperty(type = "shadow", value = JsonPrimitive("down.soft.m")),
                            ),
                        ),
                    ),
                ),
            ),
        )

        val native = when (val result = codec.encode(common)) {
            is ConfigCodecResult.Success -> result.value
            is ConfigCodecResult.Failure -> fail("encode отказал — ${result.reason.message}")
        }

        val binding = native.bindings.orEmpty().single()
        assertEquals("boolean", binding.type)
        // Список значений булевой оси не пишется: так устроены все 87 таких осей корпуса,
        // и модель плагина принимает в `values` только строки.
        assertNull(binding.values)
        // А дефолт — настоящий JSON-буль: `"false"` и `false` там не одно и то же.
        assertEquals(false, binding.defaultValue?.booleanOrNull)
    }

    @Test
    fun corpusCoversRequiredEdgeCases() {
        val configs = NativeConfigCorpus.entries.map { json.decodeFromString(NativeConfig.serializer(), it.json) }

        assertTrue(
            configs.any { it.variations.isEmpty() && it.bindings.isNullOrEmpty() },
            "в корпусе нет конфигурации без вариаций и без осей",
        )
        assertTrue(
            configs.any { config -> config.variations.any { (it.binding?.size ?: 0) > 1 } },
            "в корпусе нет вложенных вариаций",
        )
        assertTrue(
            configs.any { config -> config.variations.any { it.key != null } },
            "в корпусе нет вариаций с полем key",
        )
        assertTrue(
            configs.any { config -> config.propertyTypes().containsAll(setOf("color", "gradient")) },
            "в корпусе нет конфигурации, где тип свойства зависит от значения оси",
        )
        assertTrue(
            configs.any { config -> config.stateNames().containsAll(setOf("checked", "indeterminate")) },
            "в корпусе нет состояний вне stateEnum соседнего репозитория",
        )
    }

    private fun decodeOrFail(text: String): CommonConfig = when (val result = codec.decode(text)) {
        is ConfigCodecResult.Success -> result.value
        is ConfigCodecResult.Failure -> fail("decode отказал: ${result.reason.message}")
    }

    private fun failureOf(text: String): ConfigCodecFailure = when (val result = codec.decode(text)) {
        is ConfigCodecResult.Success -> fail("ожидался отказ, получен успех")
        is ConfigCodecResult.Failure -> result.reason
    }
}

/**
 * Оси конфигурации, включая ось цветовой схемы, если она не объявлена в `bindings`.
 *
 * Ось схемы добавляется, потому что общий формат материализует её наравне с остальными,
 * а native-формат у 42 конфигураций корпуса её не объявляет.
 */
private fun NativeConfig.axes(): List<String> = buildList {
    addAll(bindings.orEmpty().map { it.name })
    colorSchemeAxis()?.takeIf { it !in this }?.let { add(it) }
}

private fun NativeConfig.axisDefaults(): Map<String, String> = bindings.orEmpty()
    .mapNotNull { binding -> binding.defaultValue?.let { binding.name to it.content } }
    .toMap()

private fun NativeConfig.colorSchemeAxis(): String? = resolveColorSchemeAxis()

/**
 * Значения осей, фактически встречающиеся в вариациях и записях `view`.
 *
 * Объявленный список `bindings[].values` не используется: он бывает шире встречающегося набора.
 */
private fun NativeConfig.usedAxisValues(): Map<String, Set<String>> {
    val used = mutableMapOf<String, MutableSet<String>>()
    val scheme = colorSchemeAxis()

    scheme?.let { axis -> view.keys.forEach { used.getOrPut(axis) { mutableSetOf() } += it } }
    variations.forEach { variation ->
        variation.binding.orEmpty().forEach { reference ->
            used.getOrPut(reference.name) { mutableSetOf() } += reference.value.content
        }
        scheme?.let { axis -> variation.view.keys.forEach { used.getOrPut(axis) { mutableSetOf() } += it } }
    }
    return used
}

/**
 * Свойства, сгруппированные по сочетанию значений осей, при котором они действуют.
 */
private fun NativeConfig.propertiesByCombination(): Map<Set<Pair<String, String>>, Map<String, NativeProperty>> {
    val byCombination = mutableMapOf<Set<Pair<String, String>>, Map<String, NativeProperty>>()
    val scheme = colorSchemeAxis()

    view.forEach { (valueName, entry) ->
        scheme?.let { byCombination[setOf(it to valueName)] = entry.props }
    }
    variations.forEach { variation ->
        val combination = variation.binding.orEmpty().map { it.name to it.value.content }.toSet()
        if (variation.props.isNotEmpty()) {
            byCombination[combination] = variation.props
        }
        variation.view.forEach { (valueName, entry) ->
            scheme?.let { byCombination[combination + (it to valueName)] = entry.props }
        }
    }
    return byCombination
}

private fun NativeConfig.allProperties(): List<NativeProperty> =
    props.values +
        view.values.flatMap { it.props.values } +
        variations.flatMap { variation ->
            variation.props.values + variation.view.values.flatMap { it.props.values }
        }

private fun NativeConfig.propertyTypes(): Set<String> = allProperties().map { it.type }.toSet()

private fun NativeConfig.stateNames(): Set<String> = allProperties()
    .flatMap { property -> property.states.orEmpty().flatMap { it.states } }
    .toSet()

/**
 * Объявленные значения осей вместе с их порядком: `bindings[].values` шире набора,
 * встречающегося в вариациях, и именно эта разница теряется легче всего.
 */
private fun NativeConfig.declaredAxisValues(): Map<String, List<String>> = bindings.orEmpty()
    // Оси, у которых списка нет вовсе, из сверки исключаются: восстановленная конфигурация
    // список заполняет, и это пополнение, а не потеря.
    .filter { it.values != null }
    .associate { binding -> binding.name to binding.values.orEmpty().map { it.content } }

/** Вид каждой оси: `view`, `boolean` или `enum`. */
private fun NativeConfig.axisTypes(): Map<String, String?> = bindings.orEmpty()
    .associate { it.name to it.type }

/**
 * Значения осей, объявленных типом `boolean`, вместе с их JSON-типом.
 *
 * Строка `"false"` и буль `false` — разные значения, и подмена одного другим не видна
 * в сравнении по содержимому.
 */
private fun NativeConfig.booleanAxisPrimitives(): Map<String, List<Pair<String, Boolean>>> = bindings.orEmpty()
    .filter { it.type == "boolean" && it.values != null }
    .associate { binding ->
        binding.name to binding.values.orEmpty().map { it.content to it.isString }
    }

/**
 * Идентификаторы вариаций вместе с их родителями, по координате из значений осей.
 *
 * Ключом служит координата, а не сам идентификатор: сравнение по идентификатору не заметило бы
 * перестановки, а по координате видно, какая именно вариация переименовалась.
 */
private fun NativeConfig.variationIds(): Map<String, Pair<String?, String?>> = variations.associate { variation ->
    val coordinate = variation.binding.orEmpty().joinToString(",") { "${it.name}=${it.value.content}" }
    coordinate to (variation.id?.content to variation.parent)
}
