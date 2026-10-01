package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaNormalizationResult
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaProperty
import com.dsbuilder.frontend.feature.components.domain.apimeta.ComposeApiMetaNormalizer
import com.dsbuilder.frontend.feature.components.domain.apimeta.toKebabCase
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ComposeApiMetaNormalizerTest {
    private val normalizer = ComposeApiMetaNormalizer()

    private fun normalized(text: String = COMPOSE_API_META_CORPUS, typeMap: Map<String, String> = emptyMap()) =
        assertIs<ApiMetaNormalizationResult.Normalized>(normalizer.normalize(text, typeMap))

    @Test
    fun collapsesParametersOfSeveralGroupsIntoOnePropertyPerId() {
        val manifest = normalized().manifest

        assertEquals(listOf("Avatar", "DropZone", "Slider"), manifest.components.map { it.name })
        // В корпусе 110 параметров, но 66 уникальных пар (компонент, id): один id живёт в нескольких group.
        assertEquals(66, manifest.propertyCount)
        manifest.components.forEach { component ->
            assertEquals(
                component.properties.size,
                component.properties.map { it.name }.toSet().size,
                "${component.name}: свойство встречается дважды",
            )
        }
    }

    @Test
    fun descriptionNeverMentionsTheGroup() {
        val properties = normalized().manifest.components.flatMap { it.properties }

        assertTrue(properties.isNotEmpty())
        properties.forEach { property ->
            assertTrue(
                property.description?.contains("group") != true,
                "описание ${property.name} содержит group: ${property.description}",
            )
        }
    }

    @Test
    fun descriptionCombinesMethodAndParamType() {
        val result = normalizer.normalize(
            """[{"componentName":"Box","params":[
                {"id":"shape","type":"shape","group":"root","methodName":"shape","paramSimpleType":"Shape"}
            ]}]""",
        )

        val property = assertIs<ApiMetaNormalizationResult.Normalized>(result).manifest.components.single()
            .properties.single()
        assertEquals(ApiMetaProperty("shape", "shape", listOf("shape"), "method: shape; param: Shape"), property)
    }

    @Test
    fun descriptionListsEveryParamTypeOfTheDuplicatesInOrder() {
        // Один слот приходит как Color и как InteractiveColor: тип первого вхождения был бы случайным.
        val result = normalizer.normalize(
            """[{"componentName":"Box","params":[
                {"id":"bg","type":"color","group":"colors","methodName":"bg","paramSimpleType":"Color"},
                {"id":"bg","type":"color","group":"colorValues","methodName":"bg","paramSimpleType":"InteractiveColor"},
                {"id":"bg","type":"color","group":"root","methodName":"bg","paramSimpleType":"Color"}
            ]}]""",
        )

        val property = assertIs<ApiMetaNormalizationResult.Normalized>(result).manifest.components.single()
            .properties.single()
        assertEquals("method: bg; param: Color/InteractiveColor", property.description)
    }

    @Test
    fun descriptionIsAbsentWhenThereIsNothingToSay() {
        val result = normalizer.normalize("""[{"componentName":"Box","params":[{"id":"a","type":"color"}]}]""")

        val property = assertIs<ApiMetaNormalizationResult.Normalized>(result).manifest.components.single()
            .properties.single()
        assertNull(property.description)
    }

    @Test
    fun platformNamesAreTheParameterIdAlone() {
        normalized().manifest.components.flatMap { it.properties }.forEach { property ->
            assertEquals(listOf(property.name), property.platformNames)
        }
    }

    @Test
    fun statesComeFromTheStateEnumInConfigForm() {
        val components = normalized().manifest.components.associateBy { it.name }

        // Имя без configName приводится к kebab-case, с configName берётся как есть.
        assertEquals(listOf("none", "active", "inactive"), components.getValue("Avatar").states)
        assertEquals(listOf("disabled", "idle", "dragging-over"), components.getValue("DropZone").states)
        assertEquals(emptyList(), components.getValue("Slider").states)
    }

    @Test
    fun configNameWinsOverTheDeclaredName() {
        // Здесь имя и configName расходятся, чтобы тест отличал один источник от другого.
        val result = normalizer.normalize(
            """[{"componentName":"Box","params":[{"id":"a","type":"color"}],
                "stateEnum":{"values":[{"name":"Idle","configName":"default"}]}}]""",
        )

        assertEquals(
            listOf("default"),
            assertIs<ApiMetaNormalizationResult.Normalized>(result)
                .manifest.components.single().states,
        )
    }

    @Test
    fun statesOfOneComponentAreUnique() {
        val result = normalizer.normalize(
            """[{"componentName":"Box","params":[{"id":"a","type":"color"}],
                "stateEnum":{"values":[{"name":"On"},{"name":"On","configName":"on"},{"name":""}]}}]""",
        )

        assertEquals(
            listOf("on"),
            assertIs<ApiMetaNormalizationResult.Normalized>(result)
                .manifest.components.single().states,
        )
    }

    @Test
    fun firstOccurrenceWinsAndAConflictingTypeIsReported() {
        val result = normalizer.normalize(
            """[{"componentName":"Box","params":[
                {"id":"size","type":"dimension","group":"dimensions"},
                {"id":"size","type":"float","group":"root"},
                {"id":"size","type":"dimension","group":"dimensionValues"}
            ]}]""",
        )

        val normalized = assertIs<ApiMetaNormalizationResult.Normalized>(result)
        assertEquals("dimension", normalized.manifest.components.single().properties.single().type)
        assertEquals(listOf("Box.size: kept dimension, ignored float"), normalized.conflicts)
    }

    @Test
    fun theCorpusHasNoConflictingDuplicates() {
        assertEquals(emptyList(), normalized().conflicts)
    }

    @Test
    fun mapTypeReplacesTheTypeBeforeSending() {
        val types = normalized(typeMap = mapOf("dimension" to "float")).manifest.components
            .flatMap { it.properties }.map { it.type }.toSet()

        assertTrue("dimension" !in types, "тип не подменён: $types")
        assertTrue("float" in types)
    }

    @Test
    fun componentWithoutParametersIsNotSent() {
        val result = normalizer.normalize(
            """[{"componentName":"Empty","params":[]},{"componentName":"Box","params":[{"id":"a","type":"color"}]}]""",
        )

        assertEquals(
            listOf("Box"),
            assertIs<ApiMetaNormalizationResult.Normalized>(result)
                .manifest.components.map { it.name },
        )
    }

    @Test
    fun anEmptyListMeansTheArtifactWasNotFound() {
        assertIs<ApiMetaNormalizationResult.Empty>(normalizer.normalize("[]"))
    }

    @Test
    fun aListOfComponentsWithoutParametersIsEmptyToo() {
        assertIs<ApiMetaNormalizationResult.Empty>(
            normalizer.normalize("""[{"componentName":"Empty","params":[]}]"""),
        )
    }

    @Test
    fun anObjectIsNotComposeMeta() {
        // Так выглядит мета View: корень — объект, а не список.
        val result = normalizer.normalize("""{"components":[],"sharedStates":{}}""")

        val invalid = assertNotNull(result as? ApiMetaNormalizationResult.Invalid)
        assertTrue(invalid.message.contains("not a list of components"), invalid.message)
    }

    @Test
    fun kebabCaseInsertsADashBetweenLowerAndUpper() {
        assertEquals("dragging-over", "DraggingOver".toKebabCase())
        assertEquals("checked", "Checked".toKebabCase())
        assertEquals("text-inlined", "textInlined".toKebabCase())
        assertEquals("in-edit", "InEdit".toKebabCase())
        assertEquals("", "".toKebabCase())
    }
}
