package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.application.StructuredAdapterKey
import com.dsbuilder.documentation.publication.domain.StructuredArtifact
import com.dsbuilder.documentation.publication.domain.StructuredArtifactType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertTrue

class JsonStructuredArtifactAdaptersTest {
    @Test
    fun supportedRegistryContainsOnlyComposeViewAndSwiftUi() {
        val platforms = supportedStructuredArtifactAdapters().map { it.key.platform }.toSet()

        assertEquals(setOf("compose", "android-view", "swiftui"), platforms)
    }

    @Test
    fun composeComponentCreatesOneBindingWithVariationLookup() {
        val adapter = componentAdapter("compose", "sdds-compose-components-info-v1")
        val source = fixture("compose-components.json")
        val result = adapter.adapt(artifact(StructuredArtifactType.COMPONENTS_INFO), source)
        val retried = adapter.adapt(artifact(StructuredArtifactType.COMPONENTS_INFO), source)

        assertEquals(1, result.bindings.size)
        assertEquals(result, retried)
        assertEquals("components.avatar", result.bindings.single().subject)
        assertTrue(result.lookupTerms.any { it.original == "Avatar.M" })
        assertTrue(result.lookupTerms.any { it.original == "size=m" })
    }

    @Test
    fun viewComponentPreservesResourceAndOverlayReferences() {
        val result = componentAdapter("android-view", "sdds-view-components-info-v1")
            .adapt(artifact(StructuredArtifactType.COMPONENTS_INFO), fixture("view-components.json"))

        assertTrue(result.lookupTerms.any { it.original == "Sample.Components.Avatar.M" })
        assertTrue(result.lookupTerms.any { it.original == "Sample.Overlays.AvatarM" })
    }

    @Test
    fun swiftUiComponentPreservesPlatform() {
        val result = componentAdapter("swiftui", "sdds-swiftui-components-info-v1")
            .adapt(artifact(StructuredArtifactType.COMPONENTS_INFO), fixture("ios-components.json"))

        assertEquals("swiftui", result.bindings.single().platform)
        assertTrue(result.lookupTerms.any { it.original == "FormItem.M" })
    }

    @Test
    fun themeFormatsPreservePlatformReferences() {
        val cases = listOf(
            Triple("compose", "sdds-compose-theme-info-v1", "compose-theme.json"),
            Triple("android-view", "sdds-view-theme-info-v1", "view-theme.json"),
            Triple("swiftui", "sdds-ios-theme-info-v1", "ios-theme.json"),
        )
        cases.forEach { (platform, format, fixture) ->
            val result = themeAdapter(platform, format)
                .adapt(artifact(StructuredArtifactType.THEME_INFO), fixture(fixture))
            assertEquals(platform, result.bindings.single().platform)
            assertTrue(result.lookupTerms.any { it.category == "reference" })
            assertTrue(result.lookupTerms.any { it.category == "kind" && it.original == "token" })
        }
    }

    @Test
    fun malformedElementBlocksWholeArtifact() {
        val malformed = """{"components":[{"key":"","coreName":"Avatar","styleName":"Avatar","variations":[]}]}"""

        assertFails {
            componentAdapter("compose", "sdds-compose-components-info-v1")
                .adapt(artifact(StructuredArtifactType.COMPONENTS_INFO), malformed)
        }
    }

    @Test
    fun composeComponentGroupsStyleHoldersByComponentKey() {
        val source = """
            {"components":[
              {"key":"counter","coreName":"Counter","styleName":"Counter","styleApi":{"holderName":"Default"},"variations":[]},
              {"key":"counter","coreName":"Counter","styleName":"TabBarCounter","styleApi":{"holderName":"TabBarCounter"},"variations":[]}
            ]}
        """.trimIndent()

        val result = componentAdapter("compose", "sdds-compose-components-info-v1")
            .adapt(artifact(StructuredArtifactType.COMPONENTS_INFO), source)

        assertEquals(1, result.bindings.size)
        assertEquals("components.counter", result.bindings.single().subject)
        assertTrue(result.bindings.single().platformPayload.contains("TabBarCounter"))
        assertTrue(result.lookupTerms.any { it.category == "holder" && it.original == "TabBarCounter" })
    }

    @Test
    fun componentTermsCoverEveryRequiredContractField() {
        val source = """
            {"components":[{
              "key":"avatar","coreName":"Avatar","styleName":"Avatar",
              "styleApi":{
                "stylesClassName":"AvatarStyles",
                "stylesClassQualifiedName":"com.example.AvatarStyles",
                "params":[{
                  "name":"size","type":"enum",
                  "defaultValue":{"value":"m","codeName":"M"},
                  "values":[{"value":"l","codeName":"L"}]
                }]
              },
              "variations":[{"name":"large","composeReference":"Avatar.L","props":[]}]
            }]}
        """.trimIndent()

        val terms = componentAdapter("compose", "sdds-compose-components-info-v1")
            .adapt(artifact(StructuredArtifactType.COMPONENTS_INFO), source)
            .lookupTerms
            .map { it.category to it.original }
            .toSet()

        val required = setOf(
            "subject" to "components.avatar",
            "kind" to "component-style",
            "name" to "Avatar",
            "param-name" to "size",
            "param-value" to "m",
            "param-value" to "l",
            "code-name" to "M",
            "code-name" to "L",
            "reference" to "Avatar.L",
            "class-name" to "AvatarStyles",
            "qualified-name" to "com.example.AvatarStyles",
        )
        assertTrue(terms.containsAll(required), "Missing terms: ${required - terms}")
    }

    @Test
    fun composeThemeGroupsMultilayerTokenValuesByName() {
        val source = """
            {"name":"Theme","version":"1","tokens":[
              {"type":"shadow","name":"center.hard.s","reference":"CenterHardS","value":{"blurRadius":12}},
              {"type":"shadow","name":"center.hard.s","reference":"CenterHardS","value":{"blurRadius":4}}
            ]}
        """.trimIndent()

        val result = themeAdapter("compose", "sdds-compose-theme-info-v1")
            .adapt(artifact(StructuredArtifactType.THEME_INFO), source)

        assertEquals(1, result.bindings.size)
        assertEquals("tokens.center.hard.s", result.bindings.single().subject)
        assertTrue(result.bindings.single().platformPayload.contains("\"values\":[{"))
    }

    private fun componentAdapter(platform: String, format: String) = ComponentInfoJsonAdapter(
        StructuredAdapterKey(platform, StructuredArtifactType.COMPONENTS_INFO, format),
    )

    private fun themeAdapter(platform: String, format: String) = ThemeInfoJsonAdapter(
        StructuredAdapterKey(platform, StructuredArtifactType.THEME_INFO, format),
    )

    private fun artifact(type: StructuredArtifactType) = StructuredArtifact(
        id = "artifact-1",
        publicationId = "publication-1",
        type = type,
        format = "fixture",
        storageKey = "fixture.json",
        sha256 = "0".repeat(64),
        size = 1,
    )

    private fun fixture(name: String): String = checkNotNull(
        javaClass.getResource("/contracts/$name"),
    ).readText()
}
