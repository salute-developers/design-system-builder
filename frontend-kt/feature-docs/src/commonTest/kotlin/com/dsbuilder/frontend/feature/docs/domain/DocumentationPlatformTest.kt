package com.dsbuilder.frontend.feature.docs.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DocumentationPlatformTest {
    @Test
    fun canonicalPlatformsAreParsedWithoutAliases() {
        val values = listOf("compose", "android-view", "swiftui", "uikit", "react", "design")

        assertEquals(values, values.mapNotNull(DocumentationPlatform::fromManifestValue).map { it.manifestValue })
        assertNull(DocumentationPlatform.fromManifestValue("xml"))
        assertNull(DocumentationPlatform.fromManifestValue("ios"))
        assertNull(DocumentationPlatform.fromManifestValue("Compose"))
    }

    @Test
    fun composeAndViewFormatsAreVersioned() {
        assertFormats(
            platform = DocumentationPlatform.COMPOSE,
            components = "sdds-compose-components-info-v1",
            theme = "sdds-compose-theme-info-v1",
        )
        assertFormats(
            platform = DocumentationPlatform.ANDROID_VIEW,
            components = "sdds-view-components-info-v1",
            theme = "sdds-view-theme-info-v1",
        )
    }

    @Test
    fun swiftUiFormatsAreVersioned() {
        assertFormats(
            platform = DocumentationPlatform.SWIFT_UI,
            components = "sdds-swiftui-components-info-v1",
            theme = "sdds-ios-theme-info-v1",
        )
    }

    @Test
    fun markdownOnlyPlatformsHaveNoInfoFormats() {
        listOf(
            DocumentationPlatform.UI_KIT,
            DocumentationPlatform.REACT,
            DocumentationPlatform.DESIGN,
        ).forEach { platform ->
            assertNull(platform.infoArtifactFormat(ArtifactType.COMPONENTS_INFO))
            assertNull(platform.infoArtifactFormat(ArtifactType.THEME_INFO))
        }
    }

    private fun assertFormats(
        platform: DocumentationPlatform,
        components: String,
        theme: String,
    ) {
        assertEquals(components, platform.infoArtifactFormat(ArtifactType.COMPONENTS_INFO))
        assertEquals(theme, platform.infoArtifactFormat(ArtifactType.THEME_INFO))
    }
}
