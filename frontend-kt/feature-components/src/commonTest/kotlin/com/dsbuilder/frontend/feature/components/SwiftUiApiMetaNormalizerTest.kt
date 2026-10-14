package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaNormalizationResult
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaSkipped
import com.dsbuilder.frontend.feature.components.domain.apimeta.SwiftUiApiMetaNormalizer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class SwiftUiApiMetaNormalizerTest {
    private val normalizer = SwiftUiApiMetaNormalizer()

    private fun normalized(text: String = SWIFTUI_API_META_CORPUS, typeMap: Map<String, String> = emptyMap()) =
        assertIs<ApiMetaNormalizationResult.Normalized>(normalizer.normalize(text, typeMap))

    private fun component(name: String, text: String = SWIFTUI_API_META_CORPUS) =
        normalized(text).manifest.components.single { it.name == name }

    @Test
    fun everyComponentWithPropertiesReachesTheManifest() {
        val manifest = normalized().manifest

        assertEquals(listOf("CheckBox", "CollapsingNavigationBar", "Divider"), manifest.components.map { it.name })
        // CheckBox: disableAlpha, toggleIconColor, toggleIconWidth; CollapsingNavigationBar: titleStyle,
        // descriptionPadding; Divider: thickness, color.
        assertEquals(7, manifest.propertyCount)
    }

    @Test
    fun thePropertyKeyIsUniqueWithinAComponent() {
        val names = component("CheckBox").properties.map { it.name }

        assertEquals(names, names.distinct())
        assertEquals(listOf("disableAlpha", "toggleIconColor", "toggleIconWidth"), names.sorted())
    }

    @Test
    fun thePlatformNameIsTheNameInCode() {
        val divider = component("Divider").properties.associateBy { it.name }

        assertEquals(listOf("thickness"), divider.getValue("thickness").platformNames)
        assertEquals(listOf("color"), divider.getValue("color").platformNames)
    }

    @Test
    fun theNamesOfRepeatedPropertiesAreAllKeptInOrder() {
        val checkBox = component("CheckBox").properties.associateBy { it.name }

        assertEquals(
            listOf("toggleColorChecked", "toggleColorIndeterminate"),
            checkBox.getValue("toggleIconColor").platformNames,
        )
        assertEquals(
            listOf("toggleCheckedIconWidth", "toggleIndeterminateIconWidth"),
            checkBox.getValue("toggleIconWidth").platformNames,
        )
    }

    @Test
    fun aRepeatThatOnlyDiffersByStateStillGivesOneProperty() {
        val bar = component("CollapsingNavigationBar").properties.associateBy { it.name }

        assertEquals(
            listOf("titleTypography", "titleTypographyCollapsed"),
            bar.getValue("titleStyle").platformNames,
        )
        // Состояние принадлежит компоненту, а не свойству: в имени и описании его быть не должно.
        assertTrue(bar.values.none { it.name.contains("collapsed") })
        assertTrue(bar.values.none { it.description.orEmpty().contains("state") })
    }

    @Test
    fun theDescriptionCarriesGroupMethodAndParamType() {
        val divider = component("Divider").properties.single { it.name == "thickness" }

        assertEquals("group: root; method: thickness; param: CGFloat", divider.description)
    }

    @Test
    fun theDescriptionOfAMergedPropertyListsEveryDistinctValue() {
        val checkBox = component("CheckBox").properties.associateBy { it.name }

        assertEquals(
            "group: size; method: toggleCheckedIconWidth/toggleIndeterminateIconWidth; param: CGFloat",
            checkBox.getValue("toggleIconWidth").description,
        )
        assertEquals(
            "group: root; method: toggleColorChecked/toggleColorIndeterminate; param: StatefulFillStyle",
            checkBox.getValue("toggleIconColor").description,
        )
    }

    @Test
    fun aSkippedPairThatArrivesFromAnotherEntryIsNotCountedAsSkipped() {
        val result = normalized()

        // `CheckBox.toggleIconWidth` размечен `unmapped`, но то же свойство приходит из группы `size`.
        assertEquals(emptyList(), result.skipped)
        assertTrue(component("CheckBox").properties.any { it.name == "toggleIconWidth" })
    }

    @Test
    fun aComponentWhoseOnlyPropertyHasNoPlatformCodeIsNotSent() {
        val result = normalizer.normalize(SWIFTUI_API_META_ONLY_UNMAPPED)

        assertIs<ApiMetaNormalizationResult.Empty>(result)
    }

    @Test
    fun theStateNameComesFromConfigNameOrKebabCase() {
        assertEquals(listOf("checked", "indeterminate"), component("CheckBox").states)
        assertEquals(listOf("collapsed"), component("CollapsingNavigationBar").states)
    }

    @Test
    fun aComponentWithoutDeclaredStatesHasNone() {
        assertEquals(emptyList(), component("Divider").states)
    }

    @Test
    fun aRepeatWithAnotherTypeIsReportedAndTheFirstOneWins() {
        val result = normalized(SWIFTUI_API_META_TYPE_CONFLICT)
        val size = result.manifest.components.single().properties.single()

        assertEquals("dimension", size.type)
        assertEquals(listOf("width"), size.platformNames)
        assertEquals(listOf("Box.size: kept dimension, ignored float"), result.conflicts)
    }

    @Test
    fun theTypeMapIsApplied() {
        val divider = component("Divider", SWIFTUI_API_META_CORPUS).properties.single { it.name == "thickness" }
        val mapped = normalized(SWIFTUI_API_META_CORPUS, mapOf("dimension" to "float"))
            .manifest.components.single { it.name == "Divider" }
            .properties.single { it.name == "thickness" }

        assertEquals("dimension", divider.type)
        assertEquals("float", mapped.type)
    }

    @Test
    fun theTypeMapIsAppliedBeforeRepeatsAreCompared() {
        val result = normalized(SWIFTUI_API_META_TYPE_CONFLICT, mapOf("float" to "dimension"))
        val size = result.manifest.components.single().properties.single()

        // После подмены типы совпадают, значит это не конфликт, а слияние имён.
        assertEquals(emptyList(), result.conflicts)
        assertEquals(listOf("width", "scale"), size.platformNames)
    }

    @Test
    fun serviceFieldsOfTheGeneratorDoNotReachTheManifest() {
        val checkBox = component("CheckBox").properties.associateBy { it.name }

        // `stateOnly` есть у `toggleIndeterminateIconWidth`, но на тип и имя свойства он не влияет.
        assertEquals("dimension", checkBox.getValue("toggleIconWidth").type)
        assertEquals("toggleIconWidth", checkBox.getValue("toggleIconWidth").name)
        assertTrue(checkBox.values.all { it.deprecations.isEmpty() })
    }

    @Test
    fun anEmptyMetaIsReportedAsEmpty() {
        assertIs<ApiMetaNormalizationResult.Empty>(normalizer.normalize("[]"))
    }

    @Test
    fun aMetaOfAnotherPlatformIsReportedAsInvalid() {
        val result = normalizer.normalize(VIEW_API_META_CORPUS)

        assertIs<ApiMetaNormalizationResult.Invalid>(result)
        assertTrue(result.message.contains("not a list of components"), result.message)
    }

    @Test
    fun textThatIsNotJsonIsReportedAsInvalid() {
        assertIs<ApiMetaNormalizationResult.Invalid>(normalizer.normalize("not json at all"))
    }

    @Test
    fun aMetaWithoutOptionalFieldsIsParsed() {
        val text = """[{"componentName":"Box","params":[{"id":"size","type":"dimension","methodName":"size"}]}]"""
        val box = normalized(text).manifest.components.single()

        assertEquals(listOf("size"), box.properties.single().platformNames)
        assertEquals("method: size", box.properties.single().description)
        assertEquals(emptyList(), box.states)
    }

    @Test
    fun skippedPropertiesAreCounted() {
        val text = """[{"componentName":"Box","params":[
            {"id":"size","type":"dimension","group":"size","methodName":"width","paramSimpleType":"CGFloat"},
            {"id":"lineColor","type":"color","group":"root","methodName":"","unmapped":true}]}]"""
        val result = normalized(text)

        assertEquals(
            listOf(ApiMetaSkipped(SwiftUiApiMetaNormalizer.SKIPPED_UNMAPPED, 1)),
            result.skipped,
        )
        assertEquals(listOf("size"), result.manifest.components.single().properties.map { it.name })
    }
}
