package com.dsbuilder.documentation.search.application

import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class SearchDocumentationUseCaseTest {
    @Test
    fun `exact tiers dominate fused markdown and remain deterministic`() = runTest {
        val index = FakeIndex(
            structured = listOf(
                hit("prefix", StructuredMatchKind.PREFIX),
                hit("other", StructuredMatchKind.EXACT_OTHER_TERM),
                hit("subject", StructuredMatchKind.EXACT_SUBJECT_OR_NAME),
                hit("reference", StructuredMatchKind.EXACT_REFERENCE),
            ),
            markdown = listOf(markdown("kb", 100.0)),
        )

        val items = found(useCase(index).execute(request())).page.items

        assertEquals(
            listOf("reference", "subject", "other"),
            items.take(3).filterIsInstance<DocumentationSearchResultDto.CodeBinding>().map { it.codeBindingId },
        )
        assertIs<DocumentationSearchResultDto.Markdown>(items[3])
    }

    @Test
    fun `strong fts competes with weak prefix through weighted rrf`() = runTest {
        val index = FakeIndex(
            structured = listOf(hit("prefix", StructuredMatchKind.PREFIX)),
            markdown = listOf(markdown("kb", 0.8)),
        )

        val items = found(useCase(index).execute(request())).page.items

        assertIs<DocumentationSearchResultDto.Markdown>(items.first())
        assertIs<DocumentationSearchResultDto.CodeBinding>(items.last())
    }

    @Test
    fun `terminal title token dominates body frequency matches`() = runTest {
        val index = FakeIndex(
            markdown = listOf(
                markdown("button-group", 10.0, title = "ButtonGroup"),
                markdown(
                    "basic-button",
                    0.5,
                    title = "BasicButton",
                    titleMatch = MarkdownTitleMatch.TOKEN_SUFFIX,
                ),
            ),
        )

        val items = found(useCase(index).execute(request(query = "Button"))).page.items

        assertEquals("basic-button", assertIs<DocumentationSearchResultDto.Markdown>(items.first()).kbUrl)
        assertEquals("title-token-suffix", assertIs<DocumentationSearchResultDto.Markdown>(items.first()).matchType)
    }

    @Test
    fun `multi channel markdown duplicates merge fields`() = runTest {
        val index = FakeIndex(
            markdown = listOf(
                markdown("kb", 0.7, MarkdownSearchChannel.TECHNICAL, setOf("technical")),
                markdown("kb", 0.8, MarkdownSearchChannel.ENGLISH, setOf("title")),
            ),
        )

        val item = assertIs<DocumentationSearchResultDto.Markdown>(
            found(useCase(index).execute(request())).page.items.single(),
        )

        assertEquals(listOf("technical", "title"), item.matchedFields)
        assertEquals("fts-english", item.matchType)
    }

    @Test
    fun `subjects pagination and hard bounds are propagated`() = runTest {
        val profile = LexicalRankingProfile(channelCandidateLimit = 2, totalCandidateLimit = 3)
        val index = FakeIndex(structured = listOf(hit("a"), hit("b"), hit("c")))

        val result = found(
            useCase(index, profile).execute(request(subjects = setOf("components.button"), cursor = 1, limit = 1)),
        )

        assertEquals(setOf("components.button"), index.structuredSubjects)
        assertEquals("b", assertIs<DocumentationSearchResultDto.CodeBinding>(result.page.items.single()).codeBindingId)
        assertEquals(2, result.page.nextCursor)
        assertEquals(2, index.candidateLimit)
    }

    @Test
    fun `candidate window does not depend on response limit`() = runTest {
        val profile = LexicalRankingProfile(channelCandidateLimit = 17)
        val first = FakeIndex()
        val second = FakeIndex()

        useCase(first, profile).execute(request(limit = 1))
        useCase(second, profile).execute(request(limit = 10))

        assertEquals(17, first.candidateLimit)
        assertEquals(first.candidateLimit, second.candidateLimit)
    }

    @Test
    fun `punctuation only query is invalid and does not resolve publication`() = runTest {
        var resolved = false
        val useCase = SearchDocumentationUseCase(
            ActivePublicationResolver { _, _, _, _ ->
                resolved = true
                "pub"
            },
            FakeIndex(),
        )

        assertEquals(DocumentationSearchOutcome.InvalidQuery, useCase.execute(request(query = ".-_:@?")))
        assertTrue(!resolved)
    }

    @Test
    fun `metrics contain bounded low cardinality dimensions only`() = runTest {
        var observation: SearchObservation? = null
        val index = FakeIndex(markdown = listOf(markdown("kb", 1.0)))
        val useCase = SearchDocumentationUseCase(
            ActivePublicationResolver { _, _, _, _ -> "pub" },
            index,
            metrics = DocumentationSearchMetrics { observation = it },
        )

        useCase.execute(request(query = "secret raw query"))

        assertEquals(1, observation?.resultCount)
        assertEquals(setOf("fts-technical"), observation?.matchChannels)
    }

    @Test
    fun `missing active publication does not query index`() = runTest {
        val index = FakeIndex()
        val useCase = SearchDocumentationUseCase(ActivePublicationResolver { _, _, _, _ -> null }, index)
        assertEquals(DocumentationSearchOutcome.PublicationNotFound, useCase.execute(request()))
        assertEquals(0, index.calls)
    }

    private fun useCase(index: FakeIndex, profile: LexicalRankingProfile = LexicalRankingProfile()) =
        SearchDocumentationUseCase(ActivePublicationResolver { _, _, _, _ -> "pub" }, index, profile)

    private fun found(outcome: DocumentationSearchOutcome) = assertIs<DocumentationSearchOutcome.Found>(outcome)

    private fun request(
        query: String = "Button",
        subjects: Set<String> = emptySet(),
        cursor: Int = 0,
        limit: Int = 20,
    ) = DocumentationSearchRequest("project", "ds", "1", "compose", query, subjects, cursor, limit)

    private fun hit(id: String, match: StructuredMatchKind = StructuredMatchKind.EXACT_REFERENCE) =
        StructuredSearchHit(id, "components.$id", "component-style", id, id, "reference", match)

    private fun markdown(
        url: String,
        rank: Double,
        channel: MarkdownSearchChannel = MarkdownSearchChannel.TECHNICAL,
        fields: Set<String> = setOf("body"),
        title: String = "Title",
        titleMatch: MarkdownTitleMatch = MarkdownTitleMatch.NONE,
    ) = MarkdownSearchHit(url, title, "Snippet", "button", emptyList(), rank, channel, fields, titleMatch)
}

private class FakeIndex(
    private val structured: List<StructuredSearchHit> = emptyList(),
    private val markdown: List<MarkdownSearchHit> = emptyList(),
) : DocumentationSearchIndex {
    var calls = 0
    var structuredSubjects: Set<String> = emptySet()
    var candidateLimit: Int = 0

    override suspend fun structured(
        publicationId: String,
        query: LexicalSearchQuery,
        subjects: Set<String>,
        candidateLimit: Int,
        profile: LexicalRankingProfile,
    ): List<StructuredSearchHit> {
        calls++
        structuredSubjects = subjects
        this.candidateLimit = candidateLimit
        return structured
    }

    override suspend fun markdown(
        publicationId: String,
        query: LexicalSearchQuery,
        subjects: Set<String>,
        candidateLimit: Int,
        profile: LexicalRankingProfile,
    ): List<MarkdownSearchHit> {
        calls++
        return markdown
    }
}
