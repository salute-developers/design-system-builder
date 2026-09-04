package com.dsbuilder.documentation.publication.presentation

import com.dsbuilder.documentation.publication.application.ActivePublicationDto
import com.dsbuilder.documentation.publication.application.AssetContentReader
import com.dsbuilder.documentation.publication.application.AssetDto
import com.dsbuilder.documentation.publication.application.BindingPageDto
import com.dsbuilder.documentation.publication.application.BindingQuery
import com.dsbuilder.documentation.publication.application.CodeBindingDto
import com.dsbuilder.documentation.publication.application.IngestionJobStatusDto
import com.dsbuilder.documentation.publication.application.NavigationNodeDto
import com.dsbuilder.documentation.publication.application.ProgressDto
import com.dsbuilder.documentation.publication.application.PublicationReadRepository
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsBytes
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PublicationReadRoutesTest {
    @Test
    fun returnsOwnedJobAndHidesOtherProject() = testApplication {
        application {
            install(ContentNegotiation) { json(Json) }
            routing { publicationReadRoutes(repository()) }
        }

        val owned = client.get("/documentation/ingestion-jobs/job-1") { header("X-Project-Id", "project-1") }
        val hidden = client.get("/documentation/ingestion-jobs/job-1") { header("X-Project-Id", "project-2") }

        assertEquals(HttpStatusCode.OK, owned.status)
        assertEquals(HttpStatusCode.NotFound, hidden.status)
    }

    @Test
    fun returnsOnlyPublishedActiveAndRequiresTrustedProject() = testApplication {
        application {
            install(ContentNegotiation) { json(Json) }
            routing { publicationReadRoutes(repository()) }
        }
        val query = "?designSystemId=ds-1&version=1.0.0&platform=compose"

        assertEquals(
            HttpStatusCode.OK,
            client.get("/documentation/publications/active$query") { header("X-Project-Id", "project-1") }.status,
        )
        assertEquals(HttpStatusCode.BadRequest, client.get("/documentation/publications/active$query").status)
    }

    @Test
    fun streamsOwnedAssetAndHidesCrossProjectAsset() = testApplication {
        val bytes = "asset".toByteArray()
        application {
            install(ContentNegotiation) { json(Json) }
            routing {
                publicationReadRoutes(repository(), AssetContentReader { _, output -> output.write(bytes) })
            }
        }

        val owned = client.get("/documentation/publications/publication-1/assets/asset-1") {
            header("X-Project-Id", "project-1")
        }
        val hidden = client.get("/documentation/publications/publication-1/assets/asset-1") {
            header("X-Project-Id", "project-2")
        }

        assertEquals(HttpStatusCode.OK, owned.status)
        assertContentEquals(bytes, owned.bodyAsBytes())
        assertEquals("nosniff", owned.headers["X-Content-Type-Options"])
        assertEquals(null, owned.headers[HttpHeaders.ContentDisposition])
        assertEquals(HttpStatusCode.NotFound, hidden.status)
    }

    @Test
    fun forcesActiveSvgAssetToDownloadWithNosniff() = testApplication {
        val svg = "<svg onload=\"alert(1)\"><script>alert(1)</script></svg>".toByteArray()
        application {
            install(ContentNegotiation) { json(Json) }
            routing {
                publicationReadRoutes(repository(), AssetContentReader { _, output -> output.write(svg) })
            }
        }

        val response = client.get("/documentation/publications/publication-1/assets/asset-svg") {
            header("X-Project-Id", "project-1")
        }

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("nosniff", response.headers["X-Content-Type-Options"])
        assertEquals("application/octet-stream", response.headers[HttpHeaders.ContentType])
        assertTrue(response.headers[HttpHeaders.ContentDisposition]?.startsWith("attachment;") == true)
        assertContentEquals(svg, response.bodyAsBytes())
    }

    @Test
    fun candidateIsInvisibleAndBindingsAreProjectScoped() = testApplication {
        application {
            install(ContentNegotiation) { json(Json) }
            routing { publicationReadRoutes(repository()) }
        }
        val candidate = client.get(
            "/documentation/publications/active?designSystemId=ds-1&version=1.0.0&platform=candidate",
        ) { header("X-Project-Id", "project-1") }
        val owned = client.get(
            "/documentation/publications/publication-1/bindings" +
                "?subject=components.avatar&kind=component-style&limit=200",
        ) { header("X-Project-Id", "project-1") }
        val hidden = client.get("/documentation/publications/publication-1/bindings/binding-1") {
            header("X-Project-Id", "project-2")
        }

        assertEquals(HttpStatusCode.NotFound, candidate.status)
        assertEquals(HttpStatusCode.OK, owned.status)
        assertEquals(HttpStatusCode.NotFound, hidden.status)
    }

    private fun repository() = object : PublicationReadRepository {
        override suspend fun ingestionJob(projectId: String, jobId: String): IngestionJobStatusDto? =
            if (projectId == "project-1" && jobId == "job-1") {
                IngestionJobStatusDto(
                    jobId, "published", "published", 1, ProgressDto(5, 5, 1, 1),
                    "2026-01-01T00:00:00Z", null, "2026-01-01T00:00:01Z", "2026-01-01T00:00:01Z", emptyList(),
                )
            } else {
                null
            }

        override suspend fun activePublication(
            projectId: String,
            designSystemId: String,
            version: String,
            platform: String,
        ): ActivePublicationDto? = if (projectId == "project-1" && platform == "compose") {
            ActivePublicationDto(
                "publication-1",
                designSystemId,
                version,
                platform,
                "published",
                "2026-01-01T00:00:01Z",
            )
        } else {
            null
        }

        override suspend fun navigation(projectId: String, publicationId: String) = emptyList<NavigationNodeDto>()
        override suspend fun page(projectId: String, publicationId: String, path: String) = null
        override suspend fun binding(projectId: String, publicationId: String, bindingId: String) =
            if (projectId == "project-1") binding() else null

        override suspend fun bindings(projectId: String, publicationId: String, query: BindingQuery) =
            if (
                projectId == "project-1" && query.subject == "components.avatar" &&
                query.kind == "component-style" && query.limit == 100
            ) {
                BindingPageDto(listOf(binding()), null)
            } else {
                null
            }
        override suspend fun asset(projectId: String, publicationId: String, assetId: String): AssetDto? =
            when {
                projectId != "project-1" || publicationId != "publication-1" -> null
                assetId == "asset-1" -> AssetDto(
                    assetId,
                    "assets/logo.png",
                    "image/png",
                    5,
                    "sha256",
                    "publications/p/assets/logo.png",
                )
                assetId == "asset-svg" -> AssetDto(
                    assetId,
                    "assets/active.svg",
                    "image/svg+xml",
                    54,
                    "sha256",
                    "publications/p/assets/active.svg",
                )
                else -> null
            }
    }

    private fun binding() = CodeBindingDto(
        "binding-1",
        "components.avatar",
        "component-style",
        "Avatar",
        "compose",
        buildJsonObject {},
    )
}
