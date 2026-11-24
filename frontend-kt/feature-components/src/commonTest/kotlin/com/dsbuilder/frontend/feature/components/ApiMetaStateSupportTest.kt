package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaManifest
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaNormalizationResult
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaNormalizer
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaProperty
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaStateSupport
import com.dsbuilder.frontend.feature.components.domain.apimeta.ComposeApiMetaNormalizer
import com.dsbuilder.frontend.feature.components.domain.apimeta.SwiftUiApiMetaNormalizer
import com.dsbuilder.frontend.feature.components.domain.apimeta.ViewApiMetaNormalizer
import com.dsbuilder.frontend.feature.components.domain.apimeta.WebApiMetaNormalizer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Вывод признака поддержки состояний нормализаторами (change add-property-state-support): общие состояния
 * приходят из поля `stateSupport` меты, правило по слотам — из того, что мета уже описывает.
 */
class ApiMetaStateSupportTest {
    private val composeStates = listOf("focused", "pressed", "hovered", "activated", "selected")
    private val viewStates = listOf("focused", "pressed", "hovered", "activated", "checked")
    private val iosStates = listOf("activated", "pressed", "hovered", "checked", "selected", "focused", "readonly")

    @Test
    fun composeStatefulValueTakesInteractionAndComponentStates() {
        val manifest = manifest(ComposeApiMetaNormalizer(), perRecord(COMPOSE_API_META_CORPUS, composeStates, true))

        val padding = manifest.property("DropZone", "paddingStart").stateSupport
        assertEquals(true, padding?.combinations)
        assertTrue(padding!!.states.containsAll(composeStates + "dragging-over"), padding.toString())
        assertEquals(composeStates, manifest.interactionStates)
    }

    @Test
    fun composeInteractiveColorTakesOnlyInteractionStates() {
        val manifest = manifest(ComposeApiMetaNormalizer(), perRecord(COMPOSE_API_META_CORPUS, composeStates, true))

        assertEquals(ApiMetaStateSupport(composeStates, true), manifest.property("Slider", "thumbColor").stateSupport)
        assertEquals(ApiMetaStateSupport.NONE, manifest.property("Slider", "orientation").stateSupport)
    }

    @Test
    fun viewTypedPropertyGetsStatesEvenWithoutStateValues() {
        val root = """{"stateSupport":{"interactionStates":${list(viewStates)},"combinations":true},"components":"""
        val manifest = manifest(ViewApiMetaNormalizer(), VIEW_API_META_CORPUS.replaceFirst("""{"components":""", root))

        val start = manifest.property("Spinner", "startColor").stateSupport
        assertEquals(viewStates, start?.states)
        val label = manifest.property("TextField", "labelColor").stateSupport
        assertTrue(label!!.states.containsAll(viewStates + "readonly"), label.toString())
        assertEquals(ApiMetaStateSupport.NONE, manifest.property("Spinner", "strokeCap").stateSupport)
        assertEquals(viewStates, manifest.interactionStates)
    }

    @Test
    fun swiftUiStatefulTypeAndStateFieldGiveDifferentSupport() {
        val manifest = manifest(SwiftUiApiMetaNormalizer(), perRecord(SWIFTUI_API_META_CORPUS, iosStates, true))

        val toggle = manifest.property("CheckBox", "toggleIconColor").stateSupport
        assertEquals(true, toggle?.combinations)
        assertTrue(toggle!!.states.containsAll(iosStates), toggle.toString())
        assertEquals(
            ApiMetaStateSupport(listOf("checked", "indeterminate"), false),
            manifest.property("CheckBox", "toggleIconWidth").stateSupport,
        )
        assertEquals(ApiMetaStateSupport.NONE, manifest.property("Divider", "thickness").stateSupport)
    }

    @Test
    fun webTakesTokenStatesWithoutCombinationsOnTheCurrentMeta() {
        val manifest = manifest(WebApiMetaNormalizer(), WEB_API_META_CORPUS)

        assertEquals(
            ApiMetaStateSupport(listOf("pressed", "hovered"), false),
            manifest.property("Button", "backgroundColor").stateSupport,
        )
        assertEquals(ApiMetaStateSupport.NONE, manifest.property("Button", "buttonBorderWidth").stateSupport)
        assertNull(manifest.interactionStates)
    }

    @Test
    fun metaWithoutTheFieldLeavesSupportUnknown() {
        listOf(
            ComposeApiMetaNormalizer() to COMPOSE_API_META_CORPUS,
            ViewApiMetaNormalizer() to VIEW_API_META_CORPUS,
            SwiftUiApiMetaNormalizer() to SWIFTUI_API_META_CORPUS,
        ).forEach { (normalizer, corpus) ->
            val manifest = manifest(normalizer, corpus)
            assertNull(manifest.interactionStates)
            assertTrue(manifest.components.flatMap { it.properties }.all { it.stateSupport == null })
        }
    }

    @Test
    fun recordsWithDifferentValuesAreInvalid() {
        val compose = perRecord(COMPOSE_API_META_CORPUS, composeStates, true)
            .replaceFirst(""""combinations":true""", """"combinations":false""")
        assertIs<ApiMetaNormalizationResult.Invalid>(ComposeApiMetaNormalizer().normalize(compose))
        val ios = perRecord(SWIFTUI_API_META_CORPUS, iosStates, true)
            .replaceFirst(""""combinations":true""", """"combinations":false""")
        assertIs<ApiMetaNormalizationResult.Invalid>(SwiftUiApiMetaNormalizer().normalize(ios))
    }

    private fun manifest(normalizer: ApiMetaNormalizer, text: String): ApiMetaManifest =
        assertIs<ApiMetaNormalizationResult.Normalized>(normalizer.normalize(text)).manifest

    private fun ApiMetaManifest.property(component: String, name: String): ApiMetaProperty =
        components.single { it.name == component }.properties.single { it.name == name }

    /** Поле `stateSupport` у каждой записи компонента, как его отдают генераторы Compose и iOS. */
    private fun perRecord(corpus: String, states: List<String>, combinations: Boolean): String =
        corpus.replace(
            """{"componentName":""",
            """{"stateSupport":{"interactionStates":${list(states)},"combinations":$combinations},"componentName":""",
        )

    private fun list(states: List<String>) = states.joinToString(",", "[", "]") { "\"$it\"" }
}
