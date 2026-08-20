@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.documentation.ingestion.presentation

import com.dsbuilder.documentation.ingestion.application.AcceptDocumentationBundleUseCase
import com.dsbuilder.documentation.ingestion.application.BundleArchiveInspector
import com.dsbuilder.documentation.ingestion.application.Clock
import com.dsbuilder.documentation.ingestion.application.DesignSystemOwnershipVerifier
import com.dsbuilder.documentation.ingestion.application.DocumentationBundleRepository
import com.dsbuilder.documentation.ingestion.application.IdGenerator
import com.dsbuilder.documentation.ingestion.application.IngestionJobRepository
import com.dsbuilder.documentation.ingestion.application.InspectedBundle
import com.dsbuilder.documentation.ingestion.application.OwnershipResult
import com.dsbuilder.documentation.ingestion.application.RawBundleStorage
import com.dsbuilder.documentation.ingestion.application.StoredBundle
import com.dsbuilder.documentation.ingestion.application.TransactionManager
import com.dsbuilder.documentation.ingestion.data.BoundedBundleUpload
import com.dsbuilder.documentation.ingestion.domain.ArtifactDeclaration
import com.dsbuilder.documentation.ingestion.domain.ArtifactKind
import com.dsbuilder.documentation.ingestion.domain.ArtifactType
import com.dsbuilder.documentation.ingestion.domain.Manifest
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals

class DocumentationBundleRoutesTest {
    @Test fun `missing bundle part returns 400`() = routeTest { client ->
        val response = client.post("/documentation/bundles") {
            trusted()
            setBody(MultiPartFormDataContent(formData { }))
        }
        assertEquals(HttpStatusCode.BadRequest, response.status)
    }

    @Test fun `missing trusted context returns 400`() = routeTest { client ->
        assertEquals(HttpStatusCode.BadRequest, client.post("/documentation/bundles").status)
    }

    @Test fun `valid editor upload returns accepted`() = routeTest { client ->
        val response = client.post("/documentation/bundles") {
            trusted()
            setBody(
                MultiPartFormDataContent(
                    formData {
                        append(
                            "bundle",
                            "archive".toByteArray(),
                            Headers.build {
                                append(HttpHeaders.ContentType, ContentType.Application.GZip.toString())
                                append(
                                    HttpHeaders.ContentDisposition,
                                    ContentDisposition.File.withParameter(
                                        ContentDisposition.Parameters.FileName,
                                        "bundle.tar.gz",
                                    ).toString(),
                                )
                            },
                        )
                    },
                ),
            )
        }
        assertEquals(HttpStatusCode.Accepted, response.status)
    }

    @Test fun `viewer upload returns forbidden`() = routeTest { client ->
        val response = client.post("/documentation/bundles") {
            trusted("viewer")
            setBody(
                MultiPartFormDataContent(
                    formData {
                        append(
                            "bundle",
                            "archive".toByteArray(),
                            Headers.build {
                                append(HttpHeaders.ContentType, ContentType.Application.GZip.toString())
                                append(
                                    HttpHeaders.ContentDisposition,
                                    ContentDisposition.File.withParameter(
                                        ContentDisposition.Parameters.FileName,
                                        "bundle.tar.gz",
                                    ).toString(),
                                )
                            },
                        )
                    },
                ),
            )
        }
        assertEquals(HttpStatusCode.Forbidden, response.status)
    }

    @Test fun `multiple bundle parts return 400 and remove temporary files`() = routeTestWithTemp { client, temp ->
        val response = client.post("/documentation/bundles") {
            trusted()
            setBody(bundleMultipart("first", "second"))
        }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals(0, Files.list(temp).use { it.count() })
    }

    @Test fun `failed later bundle part removes earlier temporary file`() = routeTestWithTemp(
        maxBytes = 4,
    ) { client, temp ->
        val response = client.post("/documentation/bundles") {
            trusted()
            setBody(bundleMultipart("ok", "too-large"))
        }

        assertEquals(HttpStatusCode.PayloadTooLarge, response.status)
        assertEquals(0, Files.list(temp).use { it.count() })
    }

    private fun routeTest(block: suspend (io.ktor.client.HttpClient) -> Unit) =
        routeTestWithTemp { client, _ -> block(client) }

    private fun routeTestWithTemp(
        maxBytes: Long = 1024,
        block: suspend (io.ktor.client.HttpClient, Path) -> Unit,
    ) = testApplication {
        val temp = Files.createTempDirectory("route-test")
        application {
            install(ContentNegotiation) {
                json()
            }
            routing { documentationBundleRoutes(useCase(), BoundedBundleUpload(temp, maxBytes)) }
        }
        try { block(client, temp) } finally { temp.toFile().deleteRecursively() }
    }

    private fun bundleMultipart(vararg contents: String) = MultiPartFormDataContent(
        formData {
            contents.forEachIndexed { index, content ->
                append(
                    "bundle",
                    content.toByteArray(),
                    Headers.build {
                        append(HttpHeaders.ContentType, ContentType.Application.GZip.toString())
                        append(
                            HttpHeaders.ContentDisposition,
                            ContentDisposition.File.withParameter(
                                ContentDisposition.Parameters.FileName,
                                "bundle-$index.tar.gz",
                            ).toString(),
                        )
                    },
                )
            }
        },
    )

    private fun useCase(): AcceptDocumentationBundleUseCase {
        var sequence = 0
        val manifest =
            Manifest(
                "1.0",
                "ds",
                "1",
                "compose",
                listOf(
                    ArtifactDeclaration(
                        ArtifactType.RESOLVED_DOCS,
                        "docs.json",
                        "dsb-resolved-docs-v1",
                        ArtifactKind.FILE,
                    ),
                ),
                "{}",
            )
        return AcceptDocumentationBundleUseCase(
            BundleArchiveInspector { InspectedBundle(manifest, 7) },
            DesignSystemOwnershipVerifier { _, _ -> OwnershipResult.OWNED },
            object : RawBundleStorage {
                override suspend fun put(
                    source: com.dsbuilder.documentation.ingestion.application.BundleSource,
                    projectId: String,
                    bundleId: String,
                ) = StoredBundle("bucket", bundleId)
                override suspend fun delete(stored: StoredBundle) = Unit
            },
            object : DocumentationBundleRepository {
                override suspend fun create(
                    bundle: com.dsbuilder.documentation.ingestion.domain.DocumentationBundle,
                ) = Unit
                override suspend fun exists(bundleId: String) = false
            },
            IngestionJobRepository { },
            object : TransactionManager { override suspend fun <T> transaction(block: suspend () -> T) = block() },
            Clock { Instant.EPOCH },
            IdGenerator { (++sequence).toString() },
        )
    }

    private fun io.ktor.client.request.HttpRequestBuilder.trusted(role: String = "editor") {
        header("X-Actor-Type", "user")
        header("X-User-Id", "user")
        header("X-Project-Id", "project")
        header("X-Project-Role", role)
    }
}
