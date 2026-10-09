package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaDeprecation
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaNormalizationResult
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaSkipped
import com.dsbuilder.frontend.feature.components.domain.apimeta.ViewApiMetaNormalizer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class ViewApiMetaNormalizerTest {
    private val normalizer = ViewApiMetaNormalizer()

    private fun normalized(text: String = VIEW_API_META_CORPUS, typeMap: Map<String, String> = emptyMap()) =
        assertIs<ApiMetaNormalizationResult.Normalized>(normalizer.normalize(text, typeMap))

    private fun component(name: String, text: String = VIEW_API_META_CORPUS) =
        normalized(text).manifest.components.single { it.name == name }

    @Test
    fun everyNameOfAMultiNameRecordBecomesAComponent() {
        val manifest = normalized().manifest

        assertEquals(
            setOf("TextArea", "TextField", "Spinner", "Counter", "Badge", "IconBadge", "Card", "Avatar"),
            manifest.components.map { it.name }.toSet(),
        )
        assertEquals(200, manifest.propertyCount)
    }

    @Test
    fun theParametersOfAMultiNameRecordAreCopiedToEveryName() {
        val badge = component("Badge").properties.map { it.name to it.type }
        val iconBadge = component("IconBadge").properties.map { it.name to it.type }

        assertEquals(16, badge.size)
        assertEquals(badge, iconBadge)
    }

    @Test
    fun twoRecordsOfOneComponentAreMergedAndItsStatesComeFromTheSecond() {
        val avatar = component("Avatar")

        // Свойства даёт запись `Avatar`, состояния — запись `SdAvatarStatus` с двумя именами.
        assertEquals(28, avatar.properties.size)
        assertEquals(listOf("active", "inactive"), avatar.states)
        assertEquals(avatar.properties.map { it.name }, avatar.properties.map { it.name }.distinct())
    }

    @Test
    fun aComponentThatOnlyHasStatesIsNotSent() {
        // `Indicator` объявлен лишь в записи `SdAvatarStatus`: свойств у него нет, заводить нечем.
        assertTrue(normalized().manifest.components.none { it.name == "Indicator" })
    }

    @Test
    fun severalXmlAttributesOfOnePropertyAreAllKeptInOrder() {
        val spinner = component("Spinner").properties.associateBy { it.name }
        val avatar = component("Avatar").properties.associateBy { it.name }

        assertEquals(
            listOf("android:maxHeight", "android:maxWidth", "android:minHeight", "android:minWidth"),
            spinner.getValue("size").platformNames,
        )
        assertEquals(listOf("android:maxHeight", "android:minHeight"), avatar.getValue("height").platformNames)
        assertEquals(listOf("android:maxWidth", "android:minWidth"), avatar.getValue("width").platformNames)
    }

    @Test
    fun aPropertyWithOneAttributeHasOnePlatformName() {
        val angle = component("Spinner").properties.single { it.name == "angle" }

        assertEquals(listOf("sd_sweepAngle"), angle.platformNames)
        assertEquals("float", angle.type)
    }

    @Test
    fun descriptionNamesTheAttributes() {
        val spinner = component("Spinner").properties.associateBy { it.name }

        assertEquals("attr: sd_sweepAngle", spinner.getValue("angle").description)
        assertEquals(
            "attr: android:maxHeight/android:maxWidth/android:minHeight/android:minWidth",
            spinner.getValue("size").description,
        )
        normalized().manifest.components.flatMap { it.properties }.forEach { property ->
            assertTrue(property.description?.startsWith("attr: ") == true, "${property.name}: ${property.description}")
            assertTrue(!property.description.orEmpty().contains("method"), property.description)
        }
    }

    @Test
    fun parametersOfTypeUnknownAreSkippedAndCounted() {
        val textField = component("TextField").properties.map { it.name }

        assertTrue("label" !in textField, "параметр типа unknown попал в манифест")
        assertTrue("placeholder" !in textField)
        assertTrue(normalized().manifest.components.flatMap { it.properties }.none { it.type == "unknown" })
    }

    @Test
    fun subStyleRecordsAreSkippedAndCounted() {
        val card = component("Card").properties.map { it.name }

        assertEquals(10, card.size, "в Card попали параметры вложенного стиля CardContent")
        assertTrue("contentShape" !in card)
        assertTrue("chipGroupStyle" !in component("TextField").properties.map { it.name })
    }

    @Test
    fun skippedEntriesAreCountedInUniqueComponentPropertyPairs() {
        assertEquals(
            listOf(
                ApiMetaSkipped("properties of type unknown", 20),
                ApiMetaSkipped("properties of sub-style records", 18),
            ),
            normalized().skipped,
        )
    }

    @Test
    fun statesComeFromStateSetsOnly() {
        val components = normalized().manifest.components.associateBy { it.name }

        assertEquals(listOf("focused"), components.getValue("TextField").states)
        assertEquals(listOf("focused"), components.getValue("TextArea").states)
        assertEquals(listOf("selected"), components.getValue("Counter").states)
        // `stateValues` на параметрах и `sharedStates` состояний компонента не объявляют.
        assertEquals(emptyList(), components.getValue("Spinner").states)
        assertEquals(emptyList(), components.getValue("Card").states)
    }

    @Test
    fun theTypeIsTakenAsIsAndMapTypeReplacesIt() {
        val spinner = component("Spinner").properties.associateBy { it.name }
        assertEquals("float", spinner.getValue("angle").type)

        val mapped = normalized(typeMap = mapOf("dimension" to "float")).manifest.components
            .flatMap { it.properties }.map { it.type }.toSet()
        assertTrue("dimension" !in mapped, "тип не подменён: $mapped")
    }

    @Test
    fun theCorpusHasNoConflictsBetweenRecords() {
        assertEquals(emptyList(), normalized().conflicts)
    }

    @Test
    fun theFullGeneratorFormWithEveryFieldIsReadToo() {
        // Сырой файл генератора содержит все поля; плагин часть из них опускает, и нормализатор читает обе формы.
        val result = normalized(
            """{"components":[{"componentNames":["Box"],"styleableName":"Box","identity":{},
              "params":[{"id":"size","attrName":"sd_size","type":"dimension","resSuffix":"size","placement":"style",
              "values":[],"defaultValue":"","stateValues":[],"resPrefix":"","valueExpr":"","condition":"",
              "shapeAdjustment":false}],"stateSets":[]}],"sharedStates":{}}""",
        )

        assertEquals(listOf("sd_size"), result.manifest.components.single().properties.single().platformNames)
    }

    @Test
    fun aRecordWithOnlyTheRequiredFieldsIsRead() {
        val result = normalized("""{"components":[{"componentNames":["Box"],"params":[{"id":"a","type":"color"}]}]}""")

        val property = result.manifest.components.single().properties.single()
        // У параметра нет `attrName`: платформенным именем остаётся `id`, а не пустая строка.
        assertEquals(listOf("a"), property.platformNames)
    }

    @Test
    fun conflictingTypesAcrossRecordsKeepTheFirstAndAreReported() {
        val result = normalized(
            """{"components":[
                {"componentNames":["Box"],"params":[{"id":"size","attrName":"sd_size","type":"dimension"}]},
                {"componentNames":["Box"],"params":[{"id":"size","attrName":"sd_size2","type":"float"}]}]}""",
        )

        val property = result.manifest.components.single().properties.single()
        assertEquals("dimension", property.type)
        assertEquals(listOf("Box.size: kept dimension, ignored float"), result.conflicts)
        // Имя противоречащей записи не добавляется: это свойство другого типа.
        assertEquals(listOf("sd_size"), property.platformNames)
    }

    @Test
    fun theSameAttributeInTwoRecordsIsNotRepeated() {
        val result = normalized(
            """{"components":[
                {"componentNames":["Box"],"params":[{"id":"w","attrName":"android:minWidth","type":"dimension"}]},
                {"componentNames":["Box"],"params":[{"id":"w","attrName":"android:minWidth","type":"dimension"},
                                                    {"id":"w","attrName":"android:maxWidth","type":"dimension"}]}]}""",
        )

        assertEquals(
            listOf("android:minWidth", "android:maxWidth"),
            result.manifest.components.single().properties.single().platformNames,
        )
    }

    @Test
    fun aSubStylePairThatAlsoComesFromANormalRecordIsKeptAndNotCountedAsSkipped() {
        val result = normalized(
            """{"components":[
                {"componentNames":["Card"],"params":[{"id":"shape","attrName":"sd_shape","type":"shape"}]},
                {"componentNames":["Card"],"subStyle":{"name":"Content","kind":"style"},
                 "params":[{"id":"shape","attrName":"sd_contentShape","type":"shape"},
                           {"id":"strokeWidth","attrName":"sd_strokeWidth","type":"dimension"}]}]}""",
        )

        assertEquals(listOf("shape"), result.manifest.components.single().properties.map { it.name })
        assertEquals(listOf(ApiMetaSkipped("properties of sub-style records", 1)), result.skipped)
    }

    @Test
    fun anUnknownPairThatIsTypedInAnotherRecordIsKept() {
        val result = normalized(
            """{"components":[
                {"componentNames":["Box"],"params":[{"id":"label","attrName":"sd_label","type":"unknown"}]},
                {"componentNames":["Box"],"params":[{"id":"label","attrName":"sd_label","type":"typography"},
                                                    {"id":"title","attrName":"sd_title","type":"unknown"}]}]}""",
        )

        assertEquals(listOf("label"), result.manifest.components.single().properties.map { it.name })
        assertEquals(listOf(ApiMetaSkipped("properties of type unknown", 1)), result.skipped)
    }

    @Test
    fun nothingSkippedMeansAnEmptySummary() {
        val result = normalized("""{"components":[{"componentNames":["Box"],"params":[{"id":"a","type":"color"}]}]}""")

        assertEquals(emptyList(), result.skipped)
    }

    @Test
    fun anEmptyMetaMeansTheArtifactWasNotFound() {
        // Так плагин записывает мету, если артефакт uikit не найден на classpath: значения по умолчанию опущены.
        assertIs<ApiMetaNormalizationResult.Empty>(normalizer.normalize("{}"))
        assertIs<ApiMetaNormalizationResult.Empty>(normalizer.normalize("""{"components":[],"sharedStates":{}}"""))
    }

    @Test
    fun recordsWithoutUsableParametersGiveAnEmptyMeta() {
        assertIs<ApiMetaNormalizationResult.Empty>(
            normalizer.normalize(
                """{"components":[{"componentNames":["Box"],"params":[{"id":"label","type":"unknown"}]}]}""",
            ),
        )
    }

    @Test
    fun aListIsNotViewMeta() {
        // Так выглядит мета Compose: корень — массив.
        val invalid = assertNotNull(normalizer.normalize("[]") as? ApiMetaNormalizationResult.Invalid)

        assertTrue(invalid.message.contains("not a View meta"), invalid.message)
    }

    @Test
    fun garbageIsInvalid() {
        assertIs<ApiMetaNormalizationResult.Invalid>(normalizer.normalize("not json"))
    }

    private val textColorMeta = """
        {"components":[
          {"componentNames":["Toast"],"styleableName":"Toast","params":[
            {"id":"textColor","attrName":"sd_textColor","type":"color","deprecated":{"message":"Use android:textColor"}},
            {"id":"textColor","attrName":"android:textColor","type":"color"}]}]}
    """

    @Test
    fun onlyTheMarkedAttributeIsDeprecated() {
        val property = component("Toast", textColorMeta).properties.single()

        assertEquals(listOf("sd_textColor", "android:textColor"), property.platformNames)
        assertEquals(mapOf("sd_textColor" to ApiMetaDeprecation("Use android:textColor")), property.deprecations)
    }

    @Test
    fun anAttributeMarkedInOneRecordStaysMarkedWhenAnotherRecordOfTheComponentRepeatsIt() {
        val property = component(
            "Toast",
            """{"components":[
              {"componentNames":["Toast"],"params":[
                {"id":"size","attrName":"android:minWidth","type":"dimension","deprecated":{"message":"old"}}]},
              {"componentNames":["Toast"],"params":[
                {"id":"size","attrName":"android:minWidth","type":"dimension"}]}]}""",
        ).properties.single()

        assertEquals(mapOf("android:minWidth" to ApiMetaDeprecation("old")), property.deprecations)
    }

    @Test
    fun anEmptyMessageStillMarksTheAttribute() {
        val property = component(
            "Toast",
            """{"components":[{"componentNames":["Toast"],"params":[
                {"id":"icon","attrName":"sd_icon","type":"icon","deprecated":{"message":""}}]}]}""",
        ).properties.single()

        assertEquals(mapOf("sd_icon" to ApiMetaDeprecation("")), property.deprecations)
    }

    @Test
    fun theCorpusWithoutDeprecatedHasNoDeprecations() {
        normalized().manifest.components.flatMap { it.properties }.forEach { property ->
            assertTrue(property.deprecations.isEmpty(), "${property.name}: ${property.deprecations}")
        }
    }
}
