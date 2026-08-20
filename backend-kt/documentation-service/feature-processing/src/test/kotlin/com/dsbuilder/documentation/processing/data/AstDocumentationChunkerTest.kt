package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.application.NormalizedCandidate
import com.dsbuilder.documentation.publication.domain.ActivePublicationKey
import com.dsbuilder.documentation.publication.domain.ContentSource
import com.dsbuilder.documentation.publication.domain.DocumentationContent
import com.dsbuilder.documentation.publication.domain.DocumentationPage
import com.dsbuilder.documentation.publication.domain.DocumentationPublication
import com.dsbuilder.documentation.publication.domain.PublicationStatus
import kotlinx.coroutines.runBlocking
import java.nio.file.Files
import java.time.Instant
import java.util.Comparator
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AstDocumentationChunkerTest {
    private val root = Files.createTempDirectory("ast-chunker-")

    @AfterTest
    fun cleanup() {
        Files.walk(root).sorted(Comparator.reverseOrder()).use { paths -> paths.forEach(Files::deleteIfExists) }
    }

    @Test
    fun splitsAtH2AndPreservesH1ContextAndDeterminism() = runBlocking {
        val markdown = """
            # Компонент Button
            Intro
            ## API
            `ButtonStyle.Primary`
            ## Примеры
            Example
        """.trimIndent()
        val candidate = candidate(listOf("first.md" to markdown))
        val chunker = AstDocumentationChunker()

        val first = chunker.chunk(candidate)
        val retry = chunker.chunk(candidate)

        assertEquals(first, retry)
        assertEquals(3, first.chunks.size)
        assertEquals(listOf("Компонент Button", "API"), first.chunks[1].headingPath)
        assertTrue(first.chunks[1].searchText.contains("ButtonStyle.Primary"))
        assertTrue(first.chunks.all { it.kbUrl.startsWith("dsb://documentation/publication-1/") })
    }

    @Test
    fun keepsMultipleContentsOrderedAndWarnsForOversizedAtomicBlock() = runBlocking {
        val largeCode = "```kotlin\n${"x".repeat(100)}\n```"
        val candidate = candidate(listOf("core.md" to largeCode, "user.md" to "## User\nДополнение"))

        val result = AstDocumentationChunker(DocumentationChunkLimits(targetBytes = 10, maxBytes = 20)).chunk(candidate)

        assertEquals(listOf("core.md", "user.md"), result.chunks.map { it.sourcePath }.distinct())
        assertEquals("OVERSIZED_ATOMIC_BLOCK", result.diagnostics.single().code)
        assertEquals(largeCode, result.chunks.first().markdown)
    }

    @Test
    fun keepsPageWithoutH2AsSingleChunkAndExtractsMixedCodeIdentifiers() = runBlocking {
        val markdown = """
            # Кнопка
            Используйте `ButtonStyle.Primary` и ТокенЦвета.
            ```kotlin
            val style = ButtonStyle.Primary
            ```
        """.trimIndent()

        val result = AstDocumentationChunker().chunk(candidate(listOf("mixed.md" to markdown)))

        assertEquals(1, result.chunks.size)
        assertEquals(listOf("Кнопка"), result.chunks.single().headingPath)
        assertTrue(result.chunks.single().searchText.contains("ТокенЦвета"))
        assertTrue(result.chunks.single().codeText.contains("ButtonStyle.Primary"))
    }

    @Test
    fun splitsOversizedSectionAtH3AndPreservesTablesAndListItems() = runBlocking {
        val markdown = """
            # API
            ## Props
            ### Size
            | name | value |
            | --- | --- |
            | size | m |

            ### Usage
            - first item with `Button.M`
            - second item
        """.trimIndent()

        val result = AstDocumentationChunker(DocumentationChunkLimits(targetBytes = 30, maxBytes = 45))
            .chunk(candidate(listOf("atomic.md" to markdown)))

        assertTrue(result.chunks.size >= 2)
        assertTrue(result.chunks.any { it.markdown.contains("| size | m |") })
        assertTrue(result.chunks.any { it.markdown.contains("- first item") && it.markdown.contains("- second item") })
    }

    @Test
    fun splitsOversizedH3SectionAgainAtWholeBlocks() = runBlocking {
        val markdown = """
            ## API
            ### Compact
            Short
            ### Large
            First paragraph with enough content.

            Second paragraph with enough content.

            Third paragraph with enough content.
        """.trimIndent()

        val result = AstDocumentationChunker(DocumentationChunkLimits(targetBytes = 45, maxBytes = 55))
            .chunk(candidate(listOf("nested.md" to markdown)))

        val largeChunks = result.chunks.filter { "Large" in it.headingPath || it.markdown.contains("paragraph") }
        assertTrue(largeChunks.size > 1)
        assertTrue(largeChunks.all { it.approximateSize <= 55 })
        assertTrue(result.diagnostics.isEmpty())
    }

    @Test
    fun appliesTargetAndMaxLimitsInUtf8Bytes() = runBlocking {
        val markdown = """
            ## Русский
            Привет мир

            Ещё текст

            🚀🚀🚀
        """.trimIndent()

        val result = AstDocumentationChunker(DocumentationChunkLimits(targetBytes = 25, maxBytes = 40))
            .chunk(candidate(listOf("utf8.md" to markdown)))

        assertTrue(result.chunks.size > 1)
        assertTrue(result.chunks.all { it.approximateSize == it.markdown.encodeToByteArray().size })
        assertTrue(result.chunks.all { it.approximateSize <= 40 })
        assertTrue(result.chunks.any { it.markdown.contains("🚀") && it.approximateSize >= 12 })
    }

    @Test
    fun splitsSingleOversizedParagraphAtSafeUtf8Boundaries() = runBlocking {
        val paragraph = List(30) { index -> "Кириллица-$index 🚀 проверка" }.joinToString(" ")

        val result = AstDocumentationChunker(DocumentationChunkLimits(targetBytes = 80, maxBytes = 100))
            .chunk(candidate(listOf("large-paragraph.md" to paragraph)))

        assertTrue(result.chunks.size > 1)
        assertTrue(result.chunks.all { it.approximateSize <= 100 })
        assertTrue(result.chunks.all { it.approximateSize == it.markdown.encodeToByteArray().size })
        assertEquals(
            paragraph.normalizedWhitespace(),
            result.chunks.joinToString(" ") { it.markdown }.normalizedWhitespace(),
        )
        assertTrue(result.diagnostics.isEmpty())
    }

    @Test
    fun excludesYamlFrontMatterFromChunksAndHeadingContext() = runBlocking {
        val markdown = """
            ---
            id: quick_start
            title: Быстрый старт
            sidebar_position: 1
            slug: /
            ---
            Введение
            ## Что прочитать дальше
            Продолжение
        """.trimIndent()

        val result = AstDocumentationChunker().chunk(candidate(listOf("quick-start.md" to markdown)))

        assertEquals(2, result.chunks.size)
        assertEquals(emptyList(), result.chunks[0].headingPath)
        assertEquals(listOf("Что прочитать дальше"), result.chunks[1].headingPath)
        assertTrue(result.chunks[0].markdown.startsWith("Введение"))
        assertTrue(result.chunks.none { it.markdown.contains("sidebar_position") })
        assertTrue(result.chunks.none { it.searchText.contains("quick_start") })
    }

    @Test
    fun frontMatterOnlyDocumentProducesNoChunks() = runBlocking {
        val markdown = """
            ---
            title: Metadata only
            ---
        """.trimIndent()

        val result = AstDocumentationChunker().chunk(candidate(listOf("metadata.md" to markdown)))

        assertTrue(result.chunks.isEmpty())
    }

    @Test
    fun horizontalRulesInRegularMarkdownArePreserved() = runBlocking {
        val markdown = """
            ---
            Обычный текст без YAML metadata
            ---
            Продолжение
        """.trimIndent()

        val result = AstDocumentationChunker().chunk(candidate(listOf("rules.md" to markdown)))

        assertEquals(markdown, result.chunks.joinToString("\n") { it.markdown })
        assertFalse(result.chunks.all { it.searchText.isBlank() })
    }

    private fun candidate(files: List<Pair<String, String>>): NormalizedCandidate {
        val page = DocumentationPage("page-1", "publication-1", "button", "Button", listOf("components.button"))
        val content = files.mapIndexed { index, (path, markdown) ->
            Files.writeString(root.resolve(path), markdown)
            DocumentationContent(
                id = "content-$index",
                pageId = page.id,
                sourcePath = path,
                source = if (index == 0) ContentSource.CORE else ContentSource.USER,
                ordinal = index,
                storageKey = "publications/publication-1/$path",
                sha256 = "sha-$index",
                size = markdown.length.toLong(),
            )
        }
        return NormalizedCandidate(
            sourceRoot = root,
            publication = DocumentationPublication(
                "publication-1",
                "project-1",
                "bundle-1",
                ActivePublicationKey("ds-1", "1.0.0", "compose"),
                PublicationStatus.CANDIDATE,
                Instant.parse("2026-01-01T00:00:00Z"),
            ),
            navigation = emptyList(),
            pages = listOf(page),
            content = content,
            assets = emptyList(),
            structuredArtifacts = emptyList(),
            bindings = emptyList(),
            lookupTerms = emptyList(),
        )
    }

    private fun String.normalizedWhitespace(): String = replace(Regex("\\s+"), " ").trim()
}
