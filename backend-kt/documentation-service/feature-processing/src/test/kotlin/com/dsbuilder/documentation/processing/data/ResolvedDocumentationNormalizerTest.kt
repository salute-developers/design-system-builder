package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.ingestion.domain.IngestionStatus
import com.dsbuilder.documentation.processing.application.ExtractedBundle
import com.dsbuilder.documentation.processing.application.PublicationContext
import com.dsbuilder.documentation.processing.application.PublicationContextProvider
import com.dsbuilder.documentation.processing.application.ResolvedContentReference
import com.dsbuilder.documentation.processing.application.ResolvedContentSource
import com.dsbuilder.documentation.processing.application.ResolvedDocumentation
import com.dsbuilder.documentation.processing.application.ResolvedDocumentationNode
import com.dsbuilder.documentation.processing.application.StructuredSourceDeclaration
import com.dsbuilder.documentation.processing.application.ValidatedBundle
import com.dsbuilder.documentation.publication.domain.ActivePublicationKey
import com.dsbuilder.documentation.publication.domain.ContentSource
import com.dsbuilder.documentation.publication.domain.StructuredArtifactType
import kotlinx.coroutines.runBlocking
import java.nio.file.Files
import java.time.Instant
import java.util.Comparator
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

class ResolvedDocumentationNormalizerTest {
    private val root = Files.createTempDirectory("documentation-normalizer-")
    private val normalizer = ResolvedDocumentationNormalizer(
        PublicationContextProvider {
            PublicationContext("project-1", ActivePublicationKey("ds-1", "1.0.0", "compose"))
        },
        PublicationObjectKeyPolicy("docs"),
    )

    @AfterTest
    fun cleanup() {
        Files.walk(root).sorted(Comparator.reverseOrder()).use { paths -> paths.forEach(Files::deleteIfExists) }
    }

    @Test
    fun normalizesOrderedTreeContentAndAssetsWithStableIds() = runBlocking {
        write("content/core.md", "core")
        write("content/user.md", "user")
        write("assets/z.png", "z")
        write("assets/a.svg", "a")
        val bundle = validatedBundle()

        val first = normalizer.normalize(job(), bundle)
        val retry = normalizer.normalize(job(), bundle)

        assertEquals(first, retry)
        assertEquals(listOf("Group", "Button"), first.navigation.map { it.title })
        assertEquals(listOf(0, 0), first.navigation.map { it.ordinal })
        assertEquals(first.navigation.first().id, first.navigation.last().parentId)
        assertEquals(listOf(ContentSource.CORE, ContentSource.USER), first.content.map { it.source })
        assertEquals(listOf(0, 1), first.content.map { it.ordinal })
        assertEquals(listOf("assets/a.svg", "assets/z.png"), first.assets.map { it.path })
        assertEquals("docs/publications/publication-1/content/core.md", first.content.first().storageKey)
        assertNotEquals(first.content[0].id, first.content[1].id)
    }

    @Test
    fun adaptsStructuredArtifactAndPreservesRawMetadata() = runBlocking {
        write("content/core.md", "core")
        write("content/user.md", "user")
        write(
            "meta/components-info.json",
            javaClass.getResource("/contracts/compose-components.json")!!.readText(),
        )
        val structuredNormalizer = ResolvedDocumentationNormalizer(
            PublicationContextProvider {
                PublicationContext(
                    "project-1",
                    ActivePublicationKey("ds-1", "1.0.0", "compose"),
                    listOf(
                        StructuredSourceDeclaration(
                            StructuredArtifactType.COMPONENTS_INFO,
                            "meta/components-info.json",
                            "sdds-compose-components-info-v1",
                        ),
                    ),
                )
            },
            PublicationObjectKeyPolicy("docs"),
        )

        val result = structuredNormalizer.normalize(job(), validatedBundle())

        assertEquals(1, result.structuredArtifacts.size)
        assertEquals("components.avatar", result.bindings.single().subject)
        assertEquals("compose", result.bindings.single().platform)
        assertEquals(result.bindings.single().id, result.lookupTerms.first().codeBindingId)
        assertEquals(
            "docs/publications/publication-1/meta/components-info.json",
            result.structuredArtifacts.single().storageKey,
        )
    }

    private fun validatedBundle(): ValidatedBundle = ValidatedBundle(
        extracted = ExtractedBundle(root, "bundle-1"),
        documentation = ResolvedDocumentation(
            listOf(
                ResolvedDocumentationNode(
                    title = "Group",
                    subjects = emptyList(),
                    hidden = false,
                    items = listOf(
                        ResolvedDocumentationNode(
                            title = "Button",
                            subjects = listOf("components.button"),
                            hidden = false,
                            items = emptyList(),
                            path = "button",
                            contentFormat = "markdown",
                            contentRefs = listOf(
                                ResolvedContentReference(ResolvedContentSource.CORE, "content/core.md"),
                                ResolvedContentReference(ResolvedContentSource.USER, "content/user.md"),
                            ),
                        ),
                    ),
                    path = null,
                    contentFormat = "markdown",
                    contentRefs = emptyList(),
                ),
            ),
        ),
        diagnostics = emptyList(),
    )

    private fun write(relative: String, value: String) {
        val path = root.resolve(relative)
        Files.createDirectories(path.parent)
        Files.writeString(path, value)
    }

    private fun job() = IngestionJob(
        id = "job-1",
        bundleId = "bundle-1",
        status = IngestionStatus.NORMALIZING,
        publicationId = "publication-1",
        createdAt = Instant.parse("2026-01-01T00:00:00Z"),
    )
}
