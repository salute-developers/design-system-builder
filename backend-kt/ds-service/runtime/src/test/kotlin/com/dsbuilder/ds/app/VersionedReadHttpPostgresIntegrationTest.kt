package com.dsbuilder.ds.app

import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.data.ExposedTransactionRunner
import com.dsbuilder.ds.core.data.PostgresTransactionFailureMapper
import com.dsbuilder.ds.tokens.data.ExposedTokenRepository
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.jdbc.Database
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Реальные запросы проверяют общую транзакцию версий, фильтры и продолжения без обхода каталога MCP. */
class VersionedReadHttpPostgresIntegrationTest {
    @Test
    fun `tenant component style group and journal filters preserve full bodies and server pages`() {
        IsolatedPostgresDatabase.create().use { database ->
            ComponentSeedFixture.seed(database.jdbcUrl, database.username, database.password)
            testApplication {
                application { module(configuration(database)) }
                val ds = createSystem(client, "lists").field("id")
                val base = "/api/ds/design-systems/$ds"
                val tenant = api(client, "POST", "/api/ds/tenants", """{"designSystemId":"$ds","name":"Target"}""")
                assertEquals(HttpStatusCode.Created, tenant.status, tenant.bodyAsText())
                val tenants = api(client, "GET", "$base/tenants?name=Target&limit=1")
                assertEquals(listOf("Target"), tenants.array().map { it.jsonObject.field("name") })
                val tenantSearch = api(client, "GET", "$base/tenants?query=arge&limit=1")
                assertEquals(tenants.array(), tenantSearch.array())
                val components = api(client, "GET", "$base/components?platform=web&limit=1")
                assertEquals(1, components.array().size)
                val component = components.array().single().jsonObject
                val exact = api(client, "GET", "$base/components?name=${component.field("name")}&platform=web&limit=1")
                assertEquals(components.array(), exact.array())
                assertTrue(api(client, "GET", "$base/components?platform=compose&limit=1").array().isEmpty())
                val componentId = component.field("id")
                val stylesPath = "$base/components/$componentId/styles"
                val allStyles = api(client, "GET", stylesPath).array()
                val stylesPage = api(client, "GET", "$stylesPath?limit=1")
                assertEquals("1", stylesPage.headers["X-DS-Page-Limit"])
                assertEquals(allStyles.take(1), stylesPage.array())
                val groups = api(client, "GET", "$base/token-groups?kind=color").array()
                assertTrue(groups.isNotEmpty())
                val pagedGroups = mutableListOf<kotlinx.serialization.json.JsonElement>()
                var groupCursor: String? = null
                do {
                    val cursorQuery = groupCursor?.let { "&cursor=$it" }.orEmpty()
                    val page = api(client, "GET", "$base/token-groups?kind=color&limit=1$cursorQuery")
                    pagedGroups.addAll(page.array())
                    groupCursor = page.headers["X-DS-Next-Cursor"]
                } while (groupCursor != null)
                assertEquals(groups, JsonArray(pagedGroups))
                assertEquals(HttpStatusCode.BadRequest, api(client, "GET", "$base/token-groups?name=Text").status)
                assertEquals(HttpStatusCode.BadRequest, api(client, "GET", "$base/token-groups?query=Text").status)
                val group = groups.first { it.jsonObject["parentId"]?.jsonPrimitive?.content == "null" }.jsonObject
                val children = api(client, "GET", "$base/token-groups?kind=color&parentId=${group.field("id")}&limit=1")
                assertEquals("1", children.headers["X-DS-Page-Limit"])
                assertTrue(children.array().all { it.jsonObject.field("parentId") == group.field("id") })
                val journal = api(client, "GET", "$base/changes?limit=1")
                assertEquals("1", journal.headers["X-DS-Page-Limit"])
                assertEquals(1, journal.array().size)
                val tenantId = tenant.obj().field("id")
                val palettePath = "/api/ds/tenants/$tenantId/palette"
                assertEquals(HttpStatusCode.BadRequest, api(client, "GET", "$palettePath?shade=green").status)
                val palette = api(client, "GET", palettePath).obj()
                val paletteGroup = palette.getValue("groups").jsonArray.first().jsonObject
                val filtered = api(client, "GET", "$palettePath?groupId=${paletteGroup.field("id")}&type=general").obj()
                assertEquals(
                    listOf(paletteGroup.field("id")),
                    filtered.getValue("groups").jsonArray.map { it.jsonObject.field("id") },
                )
                assertTrue(
                    filtered.getValue("groups").jsonArray.single().jsonObject.getValue("ramps").jsonArray.all {
                        it.jsonObject.getValue("slot").jsonObject.field("type") == "general"
                    },
                )
            }
        }
    }

    @Test
    fun `versioned reads preserve project key scopes and resource ownership`() {
        IsolatedPostgresDatabase.create().use { database ->
            testApplication {
                application { module(configuration(database)) }
                val ds = createSystem(client, "access").field("id")
                val path = "/api/ds/design-systems/$ds/tokens?limit=1"
                val key = UUID.randomUUID().toString()
                val allowed = api(client, "GET", path, key = key, scopes = "tokens:read")
                assertEquals(HttpStatusCode.OK, allowed.status, allowed.bodyAsText())
                assertEquals("1", allowed.headers["X-DS-Page-Limit"])
                assertEquals(HttpStatusCode.Forbidden, api(client, "GET", path, key = key).status)
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(client, "GET", path, key = key, scopes = "tokens:read", project = "foreign-project").status,
                )
                assertEquals(HttpStatusCode.NotFound, api(client, "GET", path, project = "foreign-project").status)
            }
        }
    }

    @Test
    fun `metadata and data retain the same snapshot across a concurrent committed write`() {
        IsolatedPostgresDatabase.create().use { database ->
            testApplication {
                application { module(configuration(database)) }
                val system = createSystem(client, "concurrent")
                val ds = system.field("id")
                val created = api(
                    client,
                    "POST",
                    "/api/ds/tokens",
                    """{"designSystemId":"$ds","name":"concurrent-old","type":"color"}""",
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val tokenId = UUID.fromString(created.obj().field("id"))
                val before = api(client, "GET", "/api/ds/tokens/$tokenId").context()
                val db = Database.connect(database.jdbcUrl, user = database.username, password = database.password)
                val runner = ExposedTransactionRunner(db, PostgresTransactionFailureMapper())
                val context = DsRequestContext(
                    ProjectPrincipal(ProjectActorType.USER, "read-owner", "read-project", projectRole = "owner"),
                    "test",
                )
                val result = runner.readOnly(
                    context,
                    ModelReadTarget(ModelReadTarget.Kind.TOKEN, tokenId),
                ) { selected ->
                    val updated = api(client, "PATCH", "/api/ds/tokens/$tokenId", """{"name":"concurrent-new"}""")
                    assertEquals(HttpStatusCode.OK, updated.status, updated.bodyAsText())
                    DsResult.Success(ExposedTokenRepository().findAccessible(selected.projectId, tokenId)?.name)
                }
                val success = assertIs<DsResult.Success<String?>>(result)
                assertEquals("concurrent-old", success.value)
                assertEquals(before.field("draftRevision").toLong(), success.readContext?.draftRevision)
                assertEquals("concurrent-new", api(client, "GET", "/api/ds/tokens/$tokenId").obj().field("name"))
            }
        }
    }

    @Test
    fun `appearance axes and defaults come from selected publication rather than current draft`() {
        IsolatedPostgresDatabase.create().use { database ->
            ComponentSeedFixture.seed(database.jdbcUrl, database.username, database.password)
            testApplication {
                application { module(configuration(database)) }
                val ds = createSystem(client, "axes").field("id")
                val appearances = api(client, "GET", "/api/ds/design-systems/$ds/appearances").array()
                assertTrue(appearances.isNotEmpty())
                val appearance = appearances.first().jsonObject
                val appearanceId = appearance.field("id")
                val path = "/api/ds/appearances/$appearanceId/variations"
                val axes = api(client, "GET", path).array()
                assertTrue(axes.isNotEmpty())
                val axis = axes.first().jsonObject
                val axisId = axis.field("id")
                val edited =
                    api(
                        client,
                        "PATCH",
                        "/api/ds/appearance-variations/$axisId",
                        """{"declaredType":"published-type"}""",
                    )
                assertEquals(HttpStatusCode.OK, edited.status, edited.bodyAsText())
                val published = publish(client, api(client, "GET", "/api/ds/design-systems/$ds").obj(), "1.0.0")
                val changed =
                    api(client, "PATCH", "/api/ds/appearance-variations/$axisId", """{"declaredType":"draft-type"}""")
                assertEquals(HttpStatusCode.OK, changed.status, changed.bodyAsText())
                val historical = api(client, "GET", "$path?version=1.0.0")
                assertEquals(HttpStatusCode.OK, historical.status, historical.bodyAsText())
                val oldAxis = historical.array().single { it.jsonObject.field("id") == axisId }.jsonObject
                assertEquals("published-type", oldAxis.field("declaredType"))
                assertEquals(axis["values"], oldAxis["values"])
                assertEquals(axis["defaultStyleId"], oldAxis["defaultStyleId"])
                assertEquals(ds, historical.context().field("designSystemId"))
                assertEquals(published.field("id"), historical.context().field("versionId"))
                val current = api(client, "GET", path).array().single { it.jsonObject.field("id") == axisId }.jsonObject
                assertEquals("draft-type", current.field("declaredType"))
                val removed = api(client, "DELETE", "/api/ds/appearances/$appearanceId")
                assertEquals(HttpStatusCode.UnprocessableEntity, removed.status, removed.bodyAsText())
                assertEquals(HttpStatusCode.OK, api(client, "GET", path).status)
                assertEquals(HttpStatusCode.OK, api(client, "GET", "$path?version=1.0.0").status)
                val versionList =
                    api(client, "GET", "/api/ds/design-system-versions/by-design-system/$ds?version=1.0.0&limit=1")
                assertEquals(listOf("1.0.0"), versionList.array().map { it.jsonObject.field("version") })
            }
        }
    }

    @Test
    fun `keyset survives deletion and revision change but rejects a new draft and foreign filters`() {
        IsolatedPostgresDatabase.create().use { database ->
            testApplication {
                application { module(configuration(database)) }
                val system = createSystem(client, "first")
                val ds = system.field("id")
                val path = "/api/ds/design-systems/$ds/tokens"
                listOf("read-a", "read-b", "read-c").forEach { name ->
                    val response = api(
                        client,
                        "POST",
                        "/api/ds/tokens",
                        """{"designSystemId":"$ds","name":"$name","type":"color"}""",
                    )
                    assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
                }
                val full = api(client, "GET", path)
                assertEquals(HttpStatusCode.OK, full.status)
                assertTrue(full.array().size > 200)
                assertNull(full.headers["X-DS-Page-Limit"])
                val first = api(client, "GET", "$path?query=read-&limit=1")
                assertEquals("1", first.headers["X-DS-Page-Limit"])
                val row = first.array().single().jsonObject
                assertEquals("read-a", row.field("name"))
                val cursor = assertNotNull(first.headers["X-DS-Next-Cursor"])
                val explicitDraft = api(client, "GET", "$path?query=read-&version=draft&limit=1")
                assertEquals(cursor, explicitDraft.headers["X-DS-Next-Cursor"])
                val oldContext = first.context()
                val deleted = api(client, "DELETE", "/api/ds/tokens/${row.field("id")}")
                assertEquals(HttpStatusCode.OK, deleted.status, deleted.bodyAsText())
                val second = api(client, "GET", "$path?query=read-&limit=2&cursor=$cursor")
                assertEquals(listOf("read-b", "read-c"), second.array().map { it.jsonObject.field("name") })
                assertNull(second.headers["X-DS-Next-Cursor"])
                assertEquals(oldContext.field("draftId"), second.context().field("draftId"))
                assertTrue(
                    second.context().field("draftRevision").toLong() > oldContext.field("draftRevision").toLong(),
                )
                val changedFilter = api(client, "GET", "$path?query=other&cursor=$cursor")
                assertEquals(HttpStatusCode.BadRequest, changedFilter.status)
                val invalidLimits = listOf("0", "-1", "201", "1.5", "bad")
                invalidLimits.forEach { limit ->
                    assertEquals(HttpStatusCode.BadRequest, api(client, "GET", "$path?limit=$limit").status)
                }
                assertEquals(HttpStatusCode.BadRequest, api(client, "GET", "$path?name=read-b&query=read").status)
                assertEquals(HttpStatusCode.BadRequest, api(client, "GET", "$path?version=draft&version=draft").status)
                assertEquals(
                    HttpStatusCode.BadRequest,
                    api(client, "GET", "$path?version=draft&versionId=${UUID.randomUUID()}").status,
                )
                val beforePublish = api(client, "GET", "/api/ds/design-systems/$ds").obj()
                val published = publish(client, beforePublish, "1.0.0")
                assertEquals(
                    HttpStatusCode.BadRequest,
                    api(client, "GET", "$path?query=read-&cursor=$cursor").status,
                )
                val history = api(client, "GET", "/api/ds/design-system-versions/by-design-system/$ds?limit=1")
                assertEquals(setOf("designSystemId"), history.context().keys)
                assertEquals("1.0.0", history.array().single().jsonObject.field("version"))
                val exact = api(client, "GET", "$path?version=1.0.0&name=read-b")
                assertEquals(HttpStatusCode.OK, exact.status, exact.bodyAsText())
                assertEquals("1.0.0", exact.context().field("version"))
                assertEquals(published.field("id"), exact.context().field("versionId"))
                val tokenId = exact.array().single().jsonObject.field("id")
                val edited = api(client, "PATCH", "/api/ds/tokens/$tokenId", """{"name":"read-renamed"}""")
                assertEquals(HttpStatusCode.OK, edited.status, edited.bodyAsText())
                val historical = api(client, "GET", "/api/ds/tokens/$tokenId?version=1.0.0")
                assertEquals("read-b", historical.obj().field("name"))
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(client, "GET", "/api/ds/tokens/$tokenId?version=9.9.9").status,
                )
                val other = createSystem(client, "second")
                val otherId = other.field("id")
                assertEquals(
                    HttpStatusCode.OK,
                    api(client, "PATCH", "/api/ds/design-systems/$otherId", "{\"description\":\"changed\"}").status,
                )
                val otherVersion = publish(client, api(client, "GET", "/api/ds/design-systems/$otherId").obj(), "1.0.0")
                assertEquals(
                    HttpStatusCode.NotFound,
                    api(client, "GET", "/api/ds/tokens/$tokenId?versionId=${otherVersion.field("id")}").status,
                )
                val unknownAppearance = api(client, "GET", "/api/ds/appearances/${UUID.randomUUID()}/variations")
                assertEquals(HttpStatusCode.NotFound, unknownAppearance.status)
            }
        }
    }

    private suspend fun createSystem(client: HttpClient, name: String): JsonObject {
        val response = api(client, "POST", "/api/ds/design-systems", """{"name":"$name","projectName":"test"}""")
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        return response.obj()
    }

    private suspend fun publish(client: HttpClient, system: JsonObject, version: String): JsonObject {
        val response =
            api(
                client,
                "POST",
                "/api/ds/design-system-versions",
                """
            {"designSystemId":"${system.field("id")}","draftId":"${system.field("draftId")}",
             "draftRevision":${system.field("draftRevision")},"version":"$version"}
                """.trimIndent(),
            )
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
        return response.obj()
    }

    private suspend fun api(
        client: HttpClient,
        method: String,
        path: String,
        body: String? = null,
        key: String? = null,
        scopes: String = "",
        project: String = "read-project",
    ): HttpResponse =
        client.request(path) {
            this.method = HttpMethod.parse(method)
            header("X-Project-Id", project)
            if (key == null) {
                header("X-Actor-Type", "user")
                header("X-User-Id", "read-owner")
                header("X-Project-Role", "owner")
            } else {
                header("X-Actor-Type", "project_key")
                header("X-Project-Key-Id", key)
                header("X-Project-Scopes", scopes)
            }
            header("Idempotency-Key", UUID.randomUUID().toString())
            body?.let {
                contentType(ContentType.Application.Json)
                setBody(it)
            }
        }

    private suspend fun HttpResponse.obj(): JsonObject = Json.parseToJsonElement(bodyAsText()).jsonObject
    private suspend fun HttpResponse.array(): JsonArray = Json.parseToJsonElement(bodyAsText()).jsonArray
    private fun HttpResponse.context(): JsonObject = Json.parseToJsonElement(
        assertNotNull(headers["X-DS-Read-Context"]),
    ).jsonObject
    private fun JsonObject.field(name: String): String = getValue(name).jsonPrimitive.content
    private fun configuration(database: IsolatedPostgresDatabase) = DsServiceConfiguration(
        0, database.jdbcUrl, database.username, database.password, 4, 5_000, null, true, false, null,
    )
}
