package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.publication.domain.StructuredArtifactType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ProcessingManifestArtifactTypeTest {
    @Test
    fun `maps persisted manifest enum names to structured types`() {
        assertEquals(StructuredArtifactType.COMPONENTS_INFO, "COMPONENTS_INFO".toStructuredArtifactType())
        assertEquals(StructuredArtifactType.THEME_INFO, "THEME_INFO".toStructuredArtifactType())
    }

    @Test
    fun `keeps backward compatibility with kebab case`() {
        assertEquals(StructuredArtifactType.COMPONENTS_INFO, "components-info".toStructuredArtifactType())
        assertEquals(StructuredArtifactType.THEME_INFO, "theme-info".toStructuredArtifactType())
        assertNull("RESOLVED_DOCS".toStructuredArtifactType())
    }
}
