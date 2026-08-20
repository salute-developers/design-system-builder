package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.ingestion.domain.IngestionStatus
import com.dsbuilder.documentation.processing.application.ExtractedBundle
import com.dsbuilder.documentation.processing.application.ResolvedContentSource
import kotlinx.coroutines.runBlocking
import java.nio.file.Files
import java.time.Instant
import java.util.Comparator
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DeepDocumentationValidatorTest {
    private val root = Files.createTempDirectory("deep-docs-validator-")
    private val validator = DeepDocumentationValidator()

    @AfterTest
    fun cleanup() {
        Files.walk(root).sorted(Comparator.reverseOrder()).use { paths -> paths.forEach(Files::deleteIfExists) }
    }

    @Test
    fun preservesNavigationAndCoreUserContentOrder() = runBlocking {
        write("content/core.md", "Core [external](https://example.com/docs)")
        write("content/user.md", "User")
        writeDocs(
            """
            {"navigation":[
              {"title":"Overview","subjects":["components.button"],"items":[
                {"title":"Button","subjects":["components.button"],"path":"button",
                 "contentRefs":[
                   {"source":"Core","path":"content/core.md"},
                   {"source":"User","path":"content/user.md"}
                 ]}
              ]}
            ]}
            """.trimIndent(),
        )

        val result = validator.validate(job(), bundle())

        assertFalse(result.hasErrors)
        val page = result.documentation.navigation.single().items.single()
        assertEquals("button", page.path)
        assertEquals(listOf(ResolvedContentSource.CORE, ResolvedContentSource.USER), page.contentRefs.map { it.source })
    }

    @Test
    fun reportsInvalidSchemaNavigationSubjectsAndMissingContent() = runBlocking {
        writeDocs(
            """
            {"navigation":[
              {"title":"Conflict","subjects":["invalid subject"],"path":"same","items":[
                {"title":"Child","subjects":[],"path":"same","contentRefs":[]}
              ]},
              {"title":"Duplicate","subjects":["tokens.color"],"path":"same",
               "contentFormat":"html","contentRefs":[{"source":"Core","path":"missing.md"}]}
            ]}
            """.trimIndent(),
        )

        val codes = validator.validate(job(), bundle()).diagnostics.map { it.code }.toSet()

        assertTrue("INVALID_NAVIGATION_NODE" in codes)
        assertTrue("INVALID_SUBJECT" in codes)
        assertTrue("DUPLICATE_PAGE_PATH" in codes)
        assertTrue("UNSUPPORTED_CONTENT_FORMAT" in codes)
        assertTrue("MISSING_CONTENT_REF" in codes)

        writeDocs("""{"navigation":[],"unexpected":true}""")
        assertEquals("INVALID_RESOLVED_DOCS", validator.validate(job(), bundle()).diagnostics.single().code)
    }

    @Test
    fun validatesLocalAssetsAndLinksWithoutFetchingExternalUrls() = runBlocking {
        write("content/page.md", "![missing](../assets/missing.png) [bad](../../outside.md) [web](https://example.com)")
        write("assets/unused.png", "unused")
        writeDocs(pageDocs("content/page.md", subjects = emptyList()))

        val diagnostics = validator.validate(job(), bundle()).diagnostics
        val codes = diagnostics.map { it.code }.toSet()

        assertTrue("MISSING_LOCAL_ASSET" in codes)
        assertTrue("UNSAFE_LOCAL_REFERENCE" in codes)
        assertTrue("UNUSED_ASSET" in codes)
        assertTrue("PAGE_WITHOUT_SUBJECTS" in codes)
        assertFalse(diagnostics.any { it.path?.contains("example.com") == true })
    }

    @Test
    fun acceptsReferencedAssetAndRejectsUnsafeContentPath() = runBlocking {
        write("content/page.md", "![logo](../assets/logo.png)")
        write("assets/logo.png", "logo")
        writeDocs(pageDocs("../outside.md"))
        assertTrue(validator.validate(job(), bundle()).diagnostics.any { it.code == "UNSAFE_PATH" })

        writeDocs(pageDocs("content/page.md"))
        val result = validator.validate(job(), bundle())
        assertFalse(result.hasErrors)
        assertFalse(result.diagnostics.any { it.code == "UNUSED_ASSET" })
    }

    @Test
    fun stopsAtDepthLimitWithoutDescendingFurther() = runBlocking {
        writeDocs(nestedDocs(depth = 4))
        val limited = DeepDocumentationValidator(DocumentationValidationLimits(maxNavigationDepth = 3))

        val result = limited.validate(job(), bundle())

        assertEquals(listOf("NAVIGATION_TOO_DEEP"), result.diagnostics.map { it.code })
        assertTrue(result.documentation.navigation.isEmpty())
    }

    @Test
    fun stopsImmediatelyAtNavigationNodeLimit() = runBlocking {
        write("content/page.md", "Page")
        writeDocs(
            """{"navigation":[${(1..3).joinToString { index -> pageNode("page-$index") }}]}""",
        )
        val limited = DeepDocumentationValidator(DocumentationValidationLimits(maxNavigationNodes = 2))

        val result = limited.validate(job(), bundle())

        assertTrue(result.diagnostics.any { it.code == "TOO_MANY_NAVIGATION_NODES" })
        assertTrue(result.documentation.navigation.isEmpty())
    }

    @Test
    fun veryDeepNavigationCannotOverflowWorkerStack() = runBlocking {
        writeDocs(nestedDocs(depth = 10_000))

        val result = validator.validate(job(), bundle())

        assertTrue(result.hasErrors)
        assertTrue(result.diagnostics.any { it.code == "INVALID_RESOLVED_DOCS" || it.code == "NAVIGATION_TOO_DEEP" })
    }

    private fun nestedDocs(depth: Int): String = buildString {
        append("{\"navigation\":[")
        repeat(depth) { append("{\"title\":\"Group\",\"subjects\":[],\"items\":[") }
        append("{\"title\":\"Page\",\"subjects\":[],\"path\":\"page\",\"contentRefs\":[]}")
        repeat(depth) { append("]}") }
        append("]}")
    }

    private fun pageNode(path: String): String =
        """{"title":"Page","subjects":[],"path":"$path","contentRefs":[{"source":"Core","path":"content/page.md"}]}"""

    private fun pageDocs(contentPath: String, subjects: List<String> = listOf("components.button")): String {
        val serializedSubjects = subjects.joinToString(prefix = "[", postfix = "]") { "\"$it\"" }
        return """
            {"navigation":[{"title":"Button","subjects":$serializedSubjects,"path":"button",
            "contentRefs":[{"source":"Core","path":"$contentPath"}]}]}
        """.trimIndent()
    }

    private fun writeDocs(value: String) = write("docs.json", value)

    private fun write(relative: String, value: String) {
        val path = root.resolve(relative)
        Files.createDirectories(path.parent)
        Files.writeString(path, value)
    }

    private fun bundle() = ExtractedBundle(root, "bundle-1")

    private fun job() = IngestionJob(
        id = "job-1",
        bundleId = "bundle-1",
        status = IngestionStatus.VALIDATING,
        createdAt = Instant.parse("2026-01-01T00:00:00Z"),
    )
}
