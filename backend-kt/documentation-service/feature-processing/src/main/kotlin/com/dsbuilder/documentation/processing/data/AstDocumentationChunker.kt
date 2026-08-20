package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.application.ChunkedCandidate
import com.dsbuilder.documentation.processing.application.DocumentationChunker
import com.dsbuilder.documentation.processing.application.NormalizedCandidate
import com.dsbuilder.documentation.publication.domain.DiagnosticLevel
import com.dsbuilder.documentation.publication.domain.DocumentationContent
import com.dsbuilder.documentation.publication.domain.DocumentationPage
import com.dsbuilder.documentation.publication.domain.KnowledgeChunk
import com.dsbuilder.documentation.publication.domain.ProcessingDiagnostic
import org.commonmark.ext.gfm.tables.TableBlock
import org.commonmark.ext.gfm.tables.TablesExtension
import org.commonmark.node.AbstractVisitor
import org.commonmark.node.Code
import org.commonmark.node.FencedCodeBlock
import org.commonmark.node.Heading
import org.commonmark.node.IndentedCodeBlock
import org.commonmark.node.ListItem
import org.commonmark.node.Node
import org.commonmark.parser.IncludeSourceSpans
import org.commonmark.parser.Parser
import org.commonmark.renderer.text.TextContentRenderer
import java.nio.file.Files
import java.security.MessageDigest

private const val MAX_UTF8_CODE_POINT_BYTES = 4

/** Лимиты AST chunking. */
data class DocumentationChunkLimits(
    /** Целевой размер chunk в UTF-8 bytes при упаковке AST blocks. */
    val targetBytes: Int = 12_000,
    /** Жёсткий максимальный размер chunk в UTF-8 bytes, кроме неделимых atomic blocks. */
    val maxBytes: Int = 24_000,
) {
    init {
        require(targetBytes > 0)
        require(maxBytes >= MAX_UTF8_CODE_POINT_BYTES)
        require(maxBytes >= targetBytes)
    }
}

/** Делит markdown по AST headings, не разрывая atomic blocks. */
class AstDocumentationChunker(
    private val limits: DocumentationChunkLimits = DocumentationChunkLimits(),
) : DocumentationChunker {
    private val parser = Parser.builder()
        .extensions(listOf(TablesExtension.create()))
        .includeSourceSpans(IncludeSourceSpans.BLOCKS)
        .build()
    private val textRenderer = TextContentRenderer.builder().build()

    override suspend fun chunk(candidate: NormalizedCandidate): ChunkedCandidate {
        val chunks = mutableListOf<KnowledgeChunk>()
        val diagnostics = mutableListOf<ProcessingDiagnostic>()
        val pages = candidate.pages.associateBy(DocumentationPage::id)
        candidate.content.forEach { content ->
            val page = requireNotNull(pages[content.pageId])
            chunks += chunkContent(candidate, page, content, diagnostics)
        }
        return ChunkedCandidate(candidate, chunks, diagnostics)
    }

    private fun chunkContent(
        candidate: NormalizedCandidate,
        page: DocumentationPage,
        content: DocumentationContent,
        diagnostics: MutableList<ProcessingDiagnostic>,
    ): List<KnowledgeChunk> {
        val markdown = Files.readString(candidate.sourceRoot.resolve(content.sourcePath)).withoutYamlFrontMatter()
        if (markdown.isBlank()) return emptyList()
        val lines = markdown.lines()
        val document = parser.parse(markdown)
        val blocks = topLevelBlocks(document)
        val ranges = sectionRanges(blocks, lines.size)
        return ranges.flatMap { range -> splitOversized(range, blocks, lines, diagnostics, candidate, content) }
            .flatMap { range -> splitRegularOversizedBlock(range, blocks, lines) }
            .mapIndexed { ordinal, fragment ->
                val fragmentNode = parser.parse(fragment.markdown)
                val headings = headingPath(document, fragment.sourceRange)
                KnowledgeChunk(
                    id = deterministicId(candidate.publication.id, content.id, ordinal.toString()),
                    publicationId = candidate.publication.id,
                    pageId = page.id,
                    contentId = content.id,
                    sourcePath = content.sourcePath,
                    ordinal = ordinal,
                    headingPath = headings,
                    pageTitle = page.title,
                    markdown = fragment.markdown,
                    searchText = textRenderer.render(fragmentNode).trim(),
                    codeText = codeText(fragmentNode),
                    subjects = page.subjects,
                    approximateSize = fragment.markdown.utf8Size(),
                    kbUrl = "dsb://documentation/${candidate.publication.id}/${content.id}/$ordinal",
                )
            }
    }

    private fun splitRegularOversizedBlock(
        range: IntRange,
        blocks: List<Node>,
        lines: List<String>,
    ): List<ChunkFragment> {
        val markdown = rangeText(range, lines).trimEnd()
        if (markdown.utf8Size() <= limits.maxBytes || blocks.any { it.matchesAtomicRange(range) }) {
            return listOf(ChunkFragment(range, markdown))
        }
        return markdown.splitAtUtf8Boundaries(limits.maxBytes).map { ChunkFragment(range, it) }
    }

    private fun sectionRanges(blocks: List<Node>, lineCount: Int): List<IntRange> {
        if (blocks.isEmpty()) return listOf(0 until lineCount)
        val boundaries = blocks.filterIsInstance<Heading>()
            .filter { it.level == H2 }
            .mapNotNull { it.lineRange()?.first }
            .toMutableList()
        if (boundaries.firstOrNull() != 0) boundaries.add(0, 0)
        return boundaries.distinct().sorted().mapIndexed { index, start ->
            start..((boundaries.distinct().sorted().getOrNull(index + 1) ?: lineCount) - 1)
        }.filterNot(IntRange::isEmpty)
    }

    @Suppress("ReturnCount")
    private fun splitOversized(
        range: IntRange,
        blocks: List<Node>,
        lines: List<String>,
        diagnostics: MutableList<ProcessingDiagnostic>,
        candidate: NormalizedCandidate,
        content: DocumentationContent,
    ): List<IntRange> {
        if (rangeText(range, lines).utf8Size() <= limits.targetBytes) return listOf(range)
        val h3 = blocks.filterIsInstance<Heading>()
            .filter { it.level == H3 && it.lineRange()?.first in range }
            .mapNotNull { it.lineRange()?.first }
        val boundaries = (listOf(range.first) + h3).distinct().sorted()
        if (boundaries.size > 1) {
            val h3Ranges = boundaries.mapIndexed { index, start ->
                start..((boundaries.getOrNull(index + 1) ?: (range.last + 1)) - 1)
            }
            return h3Ranges.flatMap { h3Range ->
                splitByBlocks(h3Range, blocks, lines, diagnostics, candidate, content)
            }
        }
        return splitByBlocks(range, blocks, lines, diagnostics, candidate, content)
    }

    private fun splitByBlocks(
        range: IntRange,
        blocks: List<Node>,
        lines: List<String>,
        diagnostics: MutableList<ProcessingDiagnostic>,
        candidate: NormalizedCandidate,
        content: DocumentationContent,
    ): List<IntRange> {
        if (rangeText(range, lines).utf8Size() <= limits.targetBytes) return listOf(range)
        val blockRanges = blocks.mapNotNull { it.lineRange() }
            .filter { it.first in range }
        val split = packBlocks(blockRanges, lines)
        val result = split.ifEmpty { listOf(range) }
        result.filter { rangeText(it, lines).utf8Size() > limits.maxBytes }.forEach { oversized ->
            if (blocks.any { block -> block.matchesAtomicRange(oversized) }) {
                diagnostics += ProcessingDiagnostic(
                    id = deterministicId(candidate.publication.id, content.id, "oversized:${oversized.first}"),
                    jobId = "publication:${candidate.publication.id}",
                    level = DiagnosticLevel.WARNING,
                    code = "OVERSIZED_ATOMIC_BLOCK",
                    message = "Atomic markdown block exceeds chunk limit",
                    path = content.sourcePath,
                )
            }
        }
        return result
    }

    private fun packBlocks(blocks: List<IntRange>, lines: List<String>): List<IntRange> {
        if (blocks.isEmpty()) return emptyList()
        val result = mutableListOf<IntRange>()
        var start = blocks.first().first
        var end = blocks.first().last
        blocks.drop(1).forEach { block ->
            if (rangeText(start..block.last, lines).utf8Size() > limits.targetBytes) {
                result += start..end
                start = block.first
            }
            end = block.last
        }
        result += start..end
        return result
    }

    private fun headingPath(document: Node, range: IntRange): List<String> {
        val result = mutableListOf<String>()
        document.accept(
            object : AbstractVisitor() {
                override fun visit(heading: Heading) {
                    val line = heading.lineRange()?.first ?: return
                    val title = textRenderer.render(heading).trim()
                    if (line <= range.first && heading.level == H1) result.replaceLevel(title)
                    if (line == range.first && heading.level in H2..H3) result += title
                }
            },
        )
        return result
    }

    private fun codeText(document: Node): String {
        val values = mutableListOf<String>()
        document.accept(
            object : AbstractVisitor() {
                override fun visit(code: Code) {
                    values += code.literal
                }

                override fun visit(codeBlock: FencedCodeBlock) {
                    values += codeBlock.literal
                }

                override fun visit(codeBlock: IndentedCodeBlock) {
                    values += codeBlock.literal
                }
            },
        )
        return values.joinToString("\n")
    }

    private fun MutableList<String>.replaceLevel(value: String) {
        clear()
        add(value)
    }

    private fun topLevelBlocks(document: Node): List<Node> = generateSequence(document.firstChild) { it.next }.toList()

    private fun Node.lineRange(): IntRange? {
        val spans = sourceSpans
        if (spans.isEmpty()) return null
        return spans.first().lineIndex..spans.last().lineIndex
    }

    private fun Node.isAtomic(): Boolean =
        this is FencedCodeBlock || this is IndentedCodeBlock || this is TableBlock || this is ListItem

    private fun Node.matchesAtomicRange(range: IntRange): Boolean =
        lineRange() == range && containsAtomicBlock()

    private fun Node.containsAtomicBlock(): Boolean =
        isAtomic() || generateSequence(firstChild) { it.next }.any { child -> child.containsAtomicBlock() }

    private fun rangeText(range: IntRange, lines: List<String>): String =
        lines.subList(range.first, range.last + 1).joinToString("\n")

    private fun String.utf8Size(): Int = encodeToByteArray().size

    private fun String.splitAtUtf8Boundaries(maxBytes: Int): List<String> {
        if (utf8Size() <= maxBytes) return listOf(this)
        val fragments = mutableListOf<String>()
        var start = 0
        while (start < length) {
            var index = start
            var size = 0
            var preferredBoundary = -1
            while (index < length) {
                val codePoint = codePointAt(index)
                val codePointBytes = codePoint.utf8Size()
                if (size + codePointBytes > maxBytes) break
                size += codePointBytes
                index += Character.charCount(codePoint)
                if (codePoint.isPreferredSplitBoundary()) preferredBoundary = index
            }
            check(index > start) { "maxBytes cannot fit one UTF-8 code point" }
            val end = if (index < length && preferredBoundary > start) preferredBoundary else index
            substring(start, end).trim().takeIf(String::isNotEmpty)?.let(fragments::add)
            start = end
        }
        return fragments
    }

    private fun Int.utf8Size(): Int = when {
        this <= 0x7F -> 1
        this <= 0x7FF -> 2
        this <= 0xFFFF -> 3
        else -> 4
    }

    private fun Int.isPreferredSplitBoundary(): Boolean =
        Character.isWhitespace(this) || this in SENTENCE_AND_WORD_BOUNDARIES

    private fun String.withoutYamlFrontMatter(): String {
        val sourceLines = lines()
        if (sourceLines.firstOrNull()?.removePrefix("\uFEFF")?.trim() != FRONT_MATTER_DELIMITER) return this
        val closingIndex = sourceLines.indexOfFirstFrom(1) {
            val value = it.trim()
            value == FRONT_MATTER_DELIMITER || value == FRONT_MATTER_END_DELIMITER
        }
        if (closingIndex < 0 || sourceLines.subList(1, closingIndex).none { YAML_KEY.matches(it) }) return this
        return sourceLines.drop(closingIndex + 1).joinToString("\n")
    }

    private inline fun List<String>.indexOfFirstFrom(startIndex: Int, predicate: (String) -> Boolean): Int {
        for (index in startIndex until size) if (predicate(this[index])) return index
        return -1
    }

    private fun deterministicId(vararg values: String): String = MessageDigest.getInstance("SHA-256")
        .digest(values.joinToString("\u0000").toByteArray())
        .take(ID_BYTES)
        .joinToString("") { byte -> "%02x".format(byte) }

    private data class ChunkFragment(val sourceRange: IntRange, val markdown: String)

    private companion object {
        const val H1 = 1
        const val H2 = 2
        const val H3 = 3
        const val ID_BYTES = 16
        const val FRONT_MATTER_DELIMITER = "---"
        const val FRONT_MATTER_END_DELIMITER = "..."
        val YAML_KEY = Regex("^[A-Za-z_][A-Za-z0-9_-]*\\s*:.*$")
        val SENTENCE_AND_WORD_BOUNDARIES = setOf('.'.code, '!'.code, '?'.code, ';'.code, ':'.code, ','.code)
    }
}
