package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaDeprecation
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaNormalizationResult
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaSkipped
import com.dsbuilder.frontend.feature.components.domain.apimeta.WebApiMetaNormalizer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class WebApiMetaNormalizerTest {
    private val normalizer = WebApiMetaNormalizer()

    private fun normalized(text: String = WEB_API_META_CORPUS, typeMap: Map<String, String> = emptyMap()) =
        assertIs<ApiMetaNormalizationResult.Normalized>(normalizer.normalize(text, typeMap))

    private fun properties(name: String, text: String = WEB_API_META_CORPUS) =
        normalized(text).manifest.components.single { it.name == name }.properties.associateBy { it.name }

    @Test
    fun tokensAreGroupedIntoOnePropertyPerComponentAndId() {
        val manifest = normalized().manifest

        assertEquals(listOf("AvatarGroup", "Button", "Link", "Spinner"), manifest.components.map { it.name })
        assertEquals(listOf(0, 27, 8, 2), manifest.components.map { it.properties.size })
        manifest.components.forEach { component ->
            val names = component.properties.map { it.name }
            assertEquals(names, names.distinct(), component.name)
        }
    }

    @Test
    fun aComponentWithoutTokensIsSentWithoutProperties() {
        // `AvatarGroup` — файл токенов без словаря: компонент в пакете есть, и в базе он нужен.
        val avatarGroup = normalized().manifest.components.single { it.name == "AvatarGroup" }

        assertEquals(emptyList(), avatarGroup.properties)
        assertEquals(emptyList(), avatarGroup.states)
    }

    @Test
    fun thePropertyIsTheIdAndThePlatformNameIsTheTokenKey() {
        val button = properties("Button")

        assertEquals(listOf("buttonDisabledOpacity"), button.getValue("disableAlpha").platformNames)
        assertEquals("float", button.getValue("disableAlpha").type)
        assertEquals(listOf("size"), properties("Spinner").getValue("size").platformNames)
    }

    @Test
    fun typographyPartsAreThePlatformNamesOfOneProperty() {
        val labelStyle = properties("Button").getValue("labelStyle")

        assertEquals("typography", labelStyle.type)
        assertEquals(
            listOf(
                "buttonFontFamily",
                "buttonFontSize",
                "buttonFontStyle",
                "buttonFontWeight",
                "buttonLetterSpacing",
                "buttonLineHeight",
            ),
            labelStyle.platformNames,
        )
    }

    @Test
    fun severalTokensOfOneValueAreAllKeptInOrder() {
        assertEquals(
            listOf("buttonLeftContentMargin", "buttonRightContentMargin"),
            properties("Button").getValue("iconMargin").platformNames,
        )
    }

    @Test
    fun stateTokensAreNotPlatformNames() {
        val button = properties("Button")
        val link = properties("Link")

        assertEquals(listOf("buttonBackgroundColor"), button.getValue("backgroundColor").platformNames)
        assertEquals(listOf("buttonColor"), button.getValue("labelColor").platformNames)
        assertEquals(listOf("linkColorVisited"), link.getValue("textColorVisited").platformNames)
    }

    @Test
    fun interactionStatesDoNotBecomeComponentStates() {
        // В корпусе только `hovered` и `pressed`: они есть в общем словаре состояний взаимодействия.
        normalized().manifest.components.forEach { assertEquals(emptyList(), it.states, it.name) }
    }

    @Test
    fun aStateOutsideTheInteractionDictionaryIsAComponentStateInKebabCase() {
        val result = normalized(
            """[{"componentName":"Checkbox","params":[
              {"paramName":"checkboxFillColor","type":"color","id":"fillColor"},
              {"paramName":"checkboxFillColorChecked","type":"color","id":"fillColor","state":"checked"},
              {"paramName":"checkboxFillColorHover","type":"color","id":"fillColor","state":"hovered"},
              {"paramName":"checkboxIconColor","type":"color","id":"iconColor"},
              {"paramName":"checkboxIconColorChecked","type":"color","id":"iconColor","state":"checked"},
              {"paramName":"checkboxIconColorHalf","type":"color","id":"iconColor","state":"halfChecked"}]}]""",
        )

        assertEquals(listOf("checked", "half-checked"), result.manifest.components.single().states)
    }

    @Test
    fun anInteractionStateIsRecognizedRegardlessOfCaseAndSeparators() {
        // Backend сопоставляет состояния без учёта регистра и знаков: `readOnly` — это общее `readonly`.
        val result = normalized(
            """[{"componentName":"TextField","params":[
              {"paramName":"inputColor","type":"color","id":"inputColor"},
              {"paramName":"inputColorReadOnly","type":"color","id":"inputColor","state":"readOnly"},
              {"paramName":"inputColorReadOnlyDash","type":"color","id":"inputColor","state":"read-only"},
              {"paramName":"inputColorDisabled","type":"color","id":"inputColor","state":"Disabled"}]}]""",
        )

        assertEquals(emptyList(), result.manifest.components.single().states)
    }

    @Test
    fun descriptionNamesTheTokens() {
        val button = properties("Button")

        assertEquals("token: buttonHeight", button.getValue("height").description)
        assertEquals(
            "token: buttonLeftContentMargin/buttonRightContentMargin",
            button.getValue("iconMargin").description,
        )
    }

    @Test
    fun aPropertyWithStateTokensOnlyIsSkippedAndCounted() {
        val result = normalized(
            """[{"componentName":"Box","params":[
              {"paramName":"boxColor","type":"color","id":"color"},
              {"paramName":"boxShadowHover","type":"shadow","id":"shadow","state":"hovered"},
              {"paramName":"boxShadowActive","type":"shadow","id":"shadow","state":"pressed"}]}]""",
        )

        assertEquals(listOf("color"), result.manifest.components.single().properties.map { it.name })
        assertEquals(listOf(ApiMetaSkipped("properties with state tokens only", 1)), result.skipped)
    }

    @Test
    fun theCorpusSkipsNothingAndHasNoConflicts() {
        val result = normalized()

        assertEquals(emptyList(), result.skipped)
        assertEquals(emptyList(), result.conflicts)
    }

    @Test
    fun aTokenWithAnotherTypeKeepsTheFirstAndIsReported() {
        val result = normalized(
            """[{"componentName":"Box","params":[
              {"paramName":"boxSize","type":"dimension","id":"size"},
              {"paramName":"boxSizeScale","type":"float","id":"size"}]}]""",
        )

        val property = result.manifest.components.single().properties.single()
        assertEquals("dimension", property.type)
        assertEquals(listOf("boxSize"), property.platformNames)
        assertEquals(listOf("Box.size: kept dimension, ignored float"), result.conflicts)
    }

    @Test
    fun mapTypeReplacesTheTypeBeforeGrouping() {
        val types = normalized(typeMap = mapOf("value" to "float")).manifest.components
            .flatMap { it.properties }.map { it.type }.toSet()

        assertTrue("value" !in types, "тип не подменён: $types")
        assertEquals("float", properties("Button").getValue("disableAlpha").type)
    }

    private val deprecatedMeta = """
        [{"componentName":"Button","params":[
          {"paramName":"buttonColor","type":"color","id":"labelColor"},
          {"paramName":"buttonTextColor","type":"color","id":"labelColor",
           "deprecated":{"message":"Используйте вместо buttonColor"}},
          {"paramName":"buttonIconColor","type":"color","id":"iconColor","deprecated":{}}]}]
    """

    @Test
    fun onlyTheMarkedTokenIsDeprecated() {
        val labelColor = properties("Button", deprecatedMeta).getValue("labelColor")

        assertEquals(listOf("buttonColor", "buttonTextColor"), labelColor.platformNames)
        assertEquals(
            mapOf("buttonTextColor" to ApiMetaDeprecation("Используйте вместо buttonColor")),
            labelColor.deprecations,
        )
    }

    @Test
    fun deprecatedWithoutAMessageMarksTheTokenWithAnEmptyMessage() {
        // Генератор пишет `{}`, когда в `@deprecated` нет `{@link}`.
        val iconColor = properties("Button", deprecatedMeta).getValue("iconColor")

        assertEquals(mapOf("buttonIconColor" to ApiMetaDeprecation("")), iconColor.deprecations)
    }

    @Test
    fun theCorpusWithoutDeprecatedHasNoDeprecations() {
        normalized().manifest.components.flatMap { it.properties }.forEach { property ->
            assertTrue(property.deprecations.isEmpty(), "${property.name}: ${property.deprecations}")
        }
    }

    @Test
    fun unknownFieldsAreIgnored() {
        val result = normalized(
            """[{"componentName":"Box","since":"1.0","params":[
              {"paramName":"boxColor","type":"color","id":"color","part":null,"extra":1}]}]""",
        )

        assertEquals(listOf("boxColor"), result.manifest.components.single().properties.single().platformNames)
    }

    @Test
    fun anEmptyMetaIsEmpty() {
        assertIs<ApiMetaNormalizationResult.Empty>(normalizer.normalize("[]"))
    }

    @Test
    fun aMetaOfComponentsWithoutTokensIsNotEmpty() {
        val result = normalized("""[{"componentName":"AvatarGroup","params":[]},{"componentName":"Image"}]""")

        assertEquals(listOf("AvatarGroup", "Image"), result.manifest.components.map { it.name })
        assertEquals(0, result.manifest.propertyCount)
    }

    @Test
    fun aComposeMetaIsNotWebMeta() {
        // Та же форма списка, но у параметров Compose нет `paramName`.
        val invalid = assertNotNull(
            normalizer.normalize(
                """[{"componentName":"Button","params":[{"id":"shape","type":"shape","methodName":"shape"}]}]""",
            ) as? ApiMetaNormalizationResult.Invalid,
        )

        assertTrue(invalid.message.contains("not a list of web components"), invalid.message)
    }

    @Test
    fun aViewMetaIsNotWebMeta() {
        assertIs<ApiMetaNormalizationResult.Invalid>(normalizer.normalize("""{"components":[]}"""))
    }

    @Test
    fun garbageIsInvalid() {
        assertIs<ApiMetaNormalizationResult.Invalid>(normalizer.normalize("not json"))
    }
}
