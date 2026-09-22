package com.dsbuilder.monolith

import kotlin.test.Test
import kotlin.test.assertNotNull

class CompositeDependenciesSmokeTest {
    @Test
    fun `included build modules resolve without publication`() {
        val substitutedClasses = listOf(
            "com.dsbuilder.identity.auth.presentation.AuthRoutesKt",
            "com.dsbuilder.projects.core.DatabaseProvider",
            "com.dsbuilder.projects.feature.projects.presentation.ProjectRoutesKt",
            "com.dsbuilder.documentation.ingestion.presentation.DocumentationBundleRoutesKt",
            "com.dsbuilder.documentation.processing.application.ProcessDocumentationJobUseCase",
            "com.dsbuilder.documentation.publication.presentation.PublicationReadRoutesKt",
            "com.dsbuilder.documentation.search.presentation.DocumentationSearchRoutesKt",
        )

        substitutedClasses.forEach { className ->
            assertNotNull(Class.forName(className), className)
        }
    }
}
