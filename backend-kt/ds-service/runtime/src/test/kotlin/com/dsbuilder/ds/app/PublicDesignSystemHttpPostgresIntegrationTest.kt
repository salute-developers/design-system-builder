package com.dsbuilder.ds.app

import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/** Проверяет публичность и отзыв через предметный HTTP-вход с настоящей БД. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class PublicDesignSystemHttpPostgresIntegrationTest {
    @Test
    fun `visibility is current and public reads only published boundaries`() {
        IsolatedPostgresDatabase.create().use { database ->
            integrationTestApplication {
                application {
                    module(
                        DsServiceConfiguration(
                            0, database.jdbcUrl, database.username, database.password,
                            4, 5_000, null, true, false, null,
                        ),
                    )
                }
                val publicReads = OpenApiDocumentResource(Json).publicReads()
                suspend fun api(
                    method: String,
                    path: String,
                    body: String? = null,
                    guest: Boolean = false,
                    project: String = "public-test",
                    etag: String? = null,
                ) =
                    client.request(path) {
                        this.method = HttpMethod.parse(method)
                        contentType(ContentType.Application.Json)
                        header("X-Project-Id", project)
                        etag?.let { header("If-None-Match", it) }
                        if (guest) {
                            val operation = publicReads.find(method, path.substringBefore('?'))
                                ?: publicReads.operations.first { it.path == "/api/design-systems/{designSystemId}" }
                            header("X-DS-Public-Read", "true")
                            header("X-DS-Public-Kind", operation.kind.name)
                            header("X-DS-Public-Method", operation.method)
                            header("X-DS-Public-Path", operation.path)
                            header("X-DS-Public-Permission", operation.permission)
                        } else {
                            header("X-Actor-Type", "user")
                            header("X-User-Id", "owner")
                            header("X-Project-Role", "owner")
                            header("Idempotency-Key", UUID.randomUUID().toString())
                        }
                        body?.let { setBody(it) }
                    }
                val root = "/api/design-systems"
                val created = api("POST", root, """{"name":"public-fixture","projectName":"public-fixture"}""")
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val initial = Json.parseToJsonElement(created.bodyAsText()).jsonObject
                val id = initial.getValue("id").jsonPrimitive.content
                val path = "$root/$id"
                assertEquals("private", initial.getValue("visibility").jsonPrimitive.content)
                assertEquals(HttpStatusCode.NotFound, api("GET", "$path?version=draft", guest = true).status)
                assertEquals(HttpStatusCode.BadRequest, api("PATCH", path, """{"visibility":null}""").status)
                assertEquals(HttpStatusCode.BadRequest, api("PATCH", path, """{"visibility":"unknown"}""").status)
                val privateSettings = Json.parseToJsonElement(api("GET", path).bodyAsText()).jsonObject
                val opened = api("PATCH", path, """{"visibility":"public"}""")
                assertEquals(HttpStatusCode.OK, opened.status, opened.bodyAsText())
                val publicSettings = Json.parseToJsonElement(api("GET", path).bodyAsText()).jsonObject
                assertEquals(privateSettings["draftRevision"], publicSettings["draftRevision"])
                assertEquals(privateSettings["draftId"], publicSettings["draftId"])
                assertEquals(HttpStatusCode.NotFound, api("GET", path, guest = true).status)
                assertEquals(HttpStatusCode.Forbidden, api("GET", "$path?version=draft", guest = true).status)
                val tenant = api("POST", "$path/tenants", """{"name":"public-theme"}""")
                assertEquals(HttpStatusCode.Created, tenant.status, tenant.bodyAsText())
                val tenantId = Json.parseToJsonElement(tenant.bodyAsText()).jsonObject.getValue("id")
                    .jsonPrimitive.content
                api("PATCH", path, """{"name":"published-name"}""")
                val draft = Json.parseToJsonElement(api("GET", path).bodyAsText()).jsonObject
                val publish = api(
                    "POST",
                    "$path/versions",
                    """{
                        "draftId":${draft.getValue("draftId")},
                        "draftRevision":${draft.getValue("draftRevision")},
                        "version":"1.0.0","changelog":"test"
                    }""",
                )
                assertEquals(HttpStatusCode.Created, publish.status, publish.bodyAsText())
                api("PATCH", path, """{"name":"private-draft-name"}""")
                val read = api("GET", path, guest = true)
                assertEquals(HttpStatusCode.OK, read.status, read.bodyAsText())
                assertEquals("no-store", read.headers["Cache-Control"])
                assertFalse(read.bodyAsText().contains("private-draft-name"))
                val metadata = Json.parseToJsonElement(requireNotNull(read.headers["X-DS-Read-Context"])).jsonObject
                assertEquals("public", metadata.getValue("accessMode").jsonPrimitive.content)
                val versionId = metadata.getValue("versionId").jsonPrimitive.content
                for (resource in listOf(
                    "palette",
                    "state-sets",
                    "tenants",
                    "tokens",
                    "components",
                    "tenants/$tenantId/typography-styles",
                )) {
                    val response = api("GET", "$path/$resource", guest = true)
                    assertEquals(HttpStatusCode.OK, response.status, "$resource: ${response.bodyAsText()}")
                    val selected = Json.parseToJsonElement(requireNotNull(response.headers["X-DS-Read-Context"]))
                        .jsonObject
                    assertEquals(versionId, selected.getValue("versionId").jsonPrimitive.content)
                    assertEquals("no-store", response.headers["Cache-Control"])
                }
                val history = api("GET", "$path/versions", guest = true)
                assertEquals(HttpStatusCode.OK, history.status, history.bodyAsText())
                val historyContext = Json.parseToJsonElement(requireNotNull(history.headers["X-DS-Read-Context"]))
                    .jsonObject
                assertFalse("versionId" in historyContext)
                assertFalse("draftId" in historyContext)
                assertEquals(HttpStatusCode.OK, api("GET", "$path/versions/$versionId", guest = true).status)
                assertEquals(
                    HttpStatusCode.OK,
                    api("GET", "$path/versions/$versionId?id=${UUID.randomUUID()}", guest = true).status,
                )
                assertEquals(
                    HttpStatusCode.NotFound,
                    api("GET", "$path?version=draft", guest = true, project = "other-project").status,
                )

                val secondDraft = Json.parseToJsonElement(api("GET", path).bodyAsText()).jsonObject
                val secondPublication = api(
                    "POST",
                    "$path/versions",
                    """{
                        "draftId":${secondDraft.getValue("draftId")},
                        "draftRevision":${secondDraft.getValue("draftRevision")},
                        "version":"2.0.0","changelog":"second publication"
                    }""",
                )
                assertEquals(HttpStatusCode.Created, secondPublication.status, secondPublication.bodyAsText())
                api("PATCH", path, """{"name":"unpublished-third-name"}""")
                val latest = api("GET", path, guest = true)
                val latestMetadata = Json.parseToJsonElement(
                    requireNotNull(latest.headers["X-DS-Read-Context"]),
                ).jsonObject
                assertEquals("2.0.0", latestMetadata.getValue("version").jsonPrimitive.content)
                assertFalse(latest.bodyAsText().contains("unpublished-third-name"))
                val pinned = api("GET", "$path?versionId=$versionId", guest = true)
                assertEquals(HttpStatusCode.OK, pinned.status, pinned.bodyAsText())
                val pinnedName = Json.parseToJsonElement(
                    pinned.bodyAsText(),
                ).jsonObject.getValue("name").jsonPrimitive.content
                assertEquals("published-name", pinnedName)
                assertEquals(
                    HttpStatusCode.Forbidden,
                    api("PATCH", path, """{"visibility":"private"}""", guest = true).status,
                )
                assertEquals(
                    HttpStatusCode.NotFound,
                    api("GET", "$root/${UUID.randomUUID()}?version=draft", guest = true).status,
                )
                assertEquals(
                    HttpStatusCode.BadRequest,
                    api("GET", "$path?version=1.0.0&versionId=$versionId", guest = true).status,
                )
                assertEquals(HttpStatusCode.OK, api("PATCH", path, """{"visibility":"private"}""").status)
                assertEquals(HttpStatusCode.NotFound, api("GET", "$path?versionId=$versionId", guest = true).status)
                assertEquals(HttpStatusCode.OK, api("GET", path).status)
                val icons = api("GET", "$root/catalog/icons", guest = true)
                assertEquals(HttpStatusCode.OK, icons.status, icons.bodyAsText())
                assertEquals("private, no-cache", icons.headers["Cache-Control"])
                val notModified = api(
                    "GET",
                    "$root/catalog/icons",
                    guest = true,
                    etag = requireNotNull(icons.headers["ETag"]),
                )
                assertEquals(HttpStatusCode.NotModified, notModified.status)
                assertEquals("private, no-cache", notModified.headers["Cache-Control"])
            }
        }
    }
}
