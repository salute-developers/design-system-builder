package com.dsbuilder.documentation.search.presentation

import com.dsbuilder.documentation.search.application.ActivePublicationResolver
import com.dsbuilder.documentation.search.application.DocumentationSearchIndex
import com.dsbuilder.documentation.search.application.FetchKnowledgeChunkUseCase
import com.dsbuilder.documentation.search.application.KnowledgeChunkDto
import com.dsbuilder.documentation.search.application.KnowledgeChunkRepository
import com.dsbuilder.documentation.search.application.LexicalRankingProfile
import com.dsbuilder.documentation.search.application.LexicalSearchQuery
import com.dsbuilder.documentation.search.application.MarkdownSearchChannel
import com.dsbuilder.documentation.search.application.MarkdownSearchHit
import com.dsbuilder.documentation.search.application.SearchDocumentationUseCase
import com.dsbuilder.documentation.search.application.StructuredMatchKind
import com.dsbuilder.documentation.search.application.StructuredSearchHit
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DocumentationSearchRoutesTest {
    @Test
    fun `mixed search returns discriminated structured result before markdown`() = testApplication {
        application { routes() }
        val response = client.get(
            "/documentation/search?designSystemId=ds&version=1&platform=compose&query=Button",
        ) { header("X-Project-Id", "project-a") }
        assertEquals(HttpStatusCode.OK, response.status)
        val body = response.bodyAsText()
        assertTrue(body.indexOf("code-binding") < body.indexOf("markdown"))
        assertTrue(body.contains("dsb://documentation/pub/content/0"))
        assertTrue(body.contains("\"matchType\""))
        assertTrue(body.contains("\"termType\":\"reference\""))
        assertTrue(body.contains("\"matchedFields\":[\"title\"]"))
    }

    @Test
    fun `search validates required parameters and missing active`() = testApplication {
        application { routes() }
        assertEquals(HttpStatusCode.BadRequest, client.get("/documentation/search").status)
        assertEquals(
            HttpStatusCode.NotFound,
            client.get("/documentation/search?designSystemId=missing&version=1&platform=compose&query=x") {
                header("X-Project-Id", "project-a")
            }.status,
        )
    }

    @Test
    fun `search rejects cursor outside bounded candidate window`() = testApplication {
        application { routes() }

        val response = client.get(
            "/documentation/search?designSystemId=ds&version=1&platform=compose&query=x&cursor=1001",
        ) { header("X-Project-Id", "project-a") }

        assertEquals(HttpStatusCode.BadRequest, response.status)
    }

    @Test
    fun `search rejects punctuation only literal query`() = testApplication {
        application { routes() }

        val response = client.get(
            "/documentation/search?designSystemId=ds&version=1&platform=compose&query=.-_:@?",
        ) { header("X-Project-Id", "project-a") }

        assertEquals(HttpStatusCode.BadRequest, response.status)
    }

    @Test
    fun `search rejects oversized utf8 query`() = testApplication {
        application { routes() }

        val response = client.get(
            "/documentation/search?designSystemId=ds&version=1&platform=compose&query=${"я".repeat(513)}",
        ) { header("X-Project-Id", "project-a") }

        assertEquals(HttpStatusCode.BadRequest, response.status)
    }

    @Test
    fun `fetch accepts stable url and denies cross project`() = testApplication {
        application { routes() }
        val url = "dsb%3A%2F%2Fdocumentation%2Fpub%2Fcontent%2F0"
        val own = client.get("/documentation/kb/fetch?url=$url") { header("X-Project-Id", "project-a") }
        assertEquals(HttpStatusCode.OK, own.status)
        assertTrue(own.bodyAsText().contains("dsb://documentation/pub/content/0"))
        val foreign = client.get("/documentation/kb/fetch?url=$url") { header("X-Project-Id", "project-b") }
        assertEquals(HttpStatusCode.NotFound, foreign.status)
    }

    private fun io.ktor.server.application.Application.routes() {
        install(ContentNegotiation) { json(Json) }
        val repository = FakeRepository()
        routing {
            documentationSearchRoutes(
                SearchDocumentationUseCase(repository, repository),
                FetchKnowledgeChunkUseCase(repository),
            )
        }
    }
}

private class FakeRepository : ActivePublicationResolver, DocumentationSearchIndex, KnowledgeChunkRepository {
    override suspend fun resolve(
        projectId: String,
        designSystemId: String,
        version: String,
        platform: String,
    ): String? = "pub".takeUnless { designSystemId == "missing" }

    override suspend fun structured(
        publicationId: String,
        query: LexicalSearchQuery,
        subjects: Set<String>,
        candidateLimit: Int,
        profile: LexicalRankingProfile,
    ) = listOf(
        StructuredSearchHit(
            "binding",
            "components.button",
            "component-style",
            "Button",
            "Button",
            "reference",
            StructuredMatchKind.EXACT_REFERENCE,
        ),
    )

    override suspend fun markdown(
        publicationId: String,
        query: LexicalSearchQuery,
        subjects: Set<String>,
        candidateLimit: Int,
        profile: LexicalRankingProfile,
    ) = listOf(
        MarkdownSearchHit(
            "dsb://documentation/pub/content/0",
            "Button",
            "Button markdown",
            "components/button",
            listOf("components.button"),
            1.0,
            MarkdownSearchChannel.TECHNICAL,
            setOf("title"),
        ),
    )

    override suspend fun fetch(projectId: String, url: com.dsbuilder.documentation.search.application.KnowledgeUrl) =
        KnowledgeChunkDto(
            url.value,
            "pub",
            "ds",
            "1",
            "compose",
            "page",
            "components/button",
            "Button",
            "content",
            "docs/button.md",
            0,
            listOf("Button"),
            "# Button",
            "Button",
            listOf("components.button"),
        ).takeIf { projectId == "project-a" }
}
