package com.dsbuilder.ds.app

import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Исходные компоненты создаются до черновика, а ручные изменения остаются видимыми и отменяемыми. */
class ComponentBaselineHttpPostgresIntegrationTest {
    @Test
    fun `initial component configurations are baseline and later edits can be reverted`() {
        IsolatedPostgresDatabase.create().use { database ->
            ComponentSeedFixture.seed(database.jdbcUrl, database.username, database.password)
            testApplication {
                application { module(configuration(database)) }
                val key = UUID.randomUUID().toString()
                val body = """{"name":"baseline","projectName":"baseline"}"""
                val created = api(client, "POST", "/api/ds/design-systems", body, key)
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val system = Json.parseToJsonElement(created.bodyAsText()).field("id")
                val repeated = api(client, "POST", "/api/ds/design-systems", body, key)
                assertEquals(created.bodyAsText(), repeated.bodyAsText())
                val changesPath = "/api/ds/design-systems/$system/changes"
                assertEquals("[]", api(client, "GET", changesPath).bodyAsText())
                assertEquals(
                    "0",
                    query(
                        database,
                        "SELECT count(*) FROM appearance_revisions WHERE version_sequence_number <> 0",
                    ),
                )
                assertEquals("0", query(database, "SELECT count(*) FROM entity_edit_states"))
                assertTrue(query(database, "SELECT count(*) FROM appearance_revisions").toInt() > 0)
                val appearance = query(database, "SELECT id FROM appearances ORDER BY id LIMIT 1")
                val path = "/api/ds/appearances/$appearance"
                val original = Json.parseToJsonElement(api(client, "GET", path).bodyAsText()).field("name")
                val theme = api(
                    client,
                    "POST",
                    "/api/ds/tenants",
                    """{"designSystemId":"$system","name":"first"}""",
                )
                assertEquals(HttpStatusCode.Created, theme.status, theme.bodyAsText())
                val changes = Json.parseToJsonElement(api(client, "GET", changesPath).bodyAsText()).jsonArray
                assertEquals(listOf("tenant"), changes.map { it.field("entityType") })
                val edited = api(client, "PATCH", path, """{"name":"edited-baseline"}""")
                assertEquals(HttpStatusCode.OK, edited.status, edited.bodyAsText())
                val change = Json.parseToJsonElement(api(client, "GET", changesPath).bodyAsText()).jsonArray
                    .single { it.field("entityType") == "appearance" }
                assertEquals(original, change.jsonObject.getValue("previousValue").field("name"))
                val reverted = client.request("$changesPath/${change.field("changeId")}/revert") {
                    method = HttpMethod.Post
                    trusted()
                    header("Idempotency-Key", UUID.randomUUID().toString())
                    header("X-DS-Base-Revision", change.field("editRevision"))
                    contentType(ContentType.Application.Json)
                    setBody("{}")
                }
                assertEquals(HttpStatusCode.OK, reverted.status, reverted.bodyAsText())
                assertEquals(original, Json.parseToJsonElement(api(client, "GET", path).bodyAsText()).field("name"))
                assertEquals(
                    listOf("tenant"),
                    Json.parseToJsonElement(api(client, "GET", changesPath).bodyAsText())
                        .jsonArray.map { it.field("entityType") },
                )
            }
        }
    }

    @Test
    fun `late global metadata does not seed existing systems when a theme is created`() {
        IsolatedPostgresDatabase.create().use { database ->
            testApplication {
                application { module(configuration(database)) }
                val created = api(
                    client,
                    "POST",
                    "/api/ds/design-systems",
                    """{"name":"late","projectName":"late"}""",
                )
                assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
                val system = Json.parseToJsonElement(created.bodyAsText()).field("id")
                ComponentSeedFixture.seed(database.jdbcUrl, database.username, database.password)
                val theme = api(
                    client,
                    "POST",
                    "/api/ds/tenants",
                    """{"designSystemId":"$system","name":"first"}""",
                )
                assertEquals(HttpStatusCode.Created, theme.status, theme.bodyAsText())
                assertEquals("0", query(database, "SELECT count(*) FROM design_system_components"))
                val imported =
                    api(
                        client,
                        "POST",
                        "/api/ds/component-config/import",
                        """
                    {"designSystemId":"$system","platform":"web","dryRun":false,
                    "meta":{"name":"manual","source":"test"},"components":[
                    {"componentName":"button","styleName":"manual","config":{}}]}
                        """.trimIndent(),
                    )
                assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
                assertEquals("1", query(database, "SELECT count(*) FROM design_system_components"))
                val changes = api(client, "GET", "/api/ds/design-systems/$system/changes")
                assertTrue(
                    Json.parseToJsonElement(changes.bodyAsText()).jsonArray.any {
                        it.field("entityType") == "appearance"
                    },
                )
            }
        }
    }

    @Test
    fun `failed initial configuration rolls back the whole design system and can be retried`() {
        IsolatedPostgresDatabase.create().use { database ->
            ComponentSeedFixture.seed(database.jdbcUrl, database.username, database.password)
            execute(
                database,
                """
                CREATE FUNCTION fail_initial_configuration() RETURNS trigger LANGUAGE plpgsql AS ${'$'}${'$'}
                BEGIN
                    IF (SELECT count(*) FROM variation_property_value_revisions) >= 300 THEN
                        RAISE EXCEPTION 'injected_component_failure';
                    END IF;
                    RETURN NEW;
                END; ${'$'}${'$'};
                CREATE TRIGGER fail_initial_configuration BEFORE INSERT ON variation_property_value_revisions
                FOR EACH ROW EXECUTE FUNCTION fail_initial_configuration();
                """.trimIndent(),
            )
            testApplication {
                application { module(configuration(database)) }
                val key = UUID.randomUUID().toString()
                val body = """{"name":"retry baseline","projectName":"retry-baseline"}"""
                val failed = api(client, "POST", "/api/ds/design-systems", body, key)
                assertTrue(failed.status.value >= 400, failed.bodyAsText())
                listOf(
                    "design_systems",
                    "design_system_versions",
                    "tokens",
                    "appearances",
                    "design_system_components",
                    "idempotent_requests",
                    "entity_edit_states",
                    "draft_transaction_markers",
                ).forEach { table ->
                    assertEquals("0", query(database, "SELECT count(*) FROM $table"), table)
                }
                execute(database, "DROP TRIGGER fail_initial_configuration ON variation_property_value_revisions")
                execute(database, "DROP FUNCTION fail_initial_configuration()")
                val retried = api(client, "POST", "/api/ds/design-systems", body, key)
                assertEquals(HttpStatusCode.Created, retried.status, retried.bodyAsText())
            }
        }
    }

    private fun execute(database: IsolatedPostgresDatabase, sql: String) {
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password).use { connection ->
            connection.createStatement().use { it.execute(sql) }
        }
    }

    private suspend fun api(
        client: HttpClient,
        method: String,
        path: String,
        body: String? = null,
        key: String = UUID.randomUUID().toString(),
    ) = client.request(path) {
        this.method = HttpMethod.parse(method)
        trusted()
        header("Idempotency-Key", key)
        body?.let {
            contentType(ContentType.Application.Json)
            setBody(it)
        }
    }

    private fun io.ktor.client.request.HttpRequestBuilder.trusted() {
        header("X-Actor-Type", "user")
        header("X-User-Id", "baseline-owner")
        header("X-Project-Id", "baseline-project")
        header("X-Project-Role", "owner")
    }

    private fun configuration(database: IsolatedPostgresDatabase) = DsServiceConfiguration(
        0, database.jdbcUrl, database.username, database.password, 4, 5_000, null, true, false, null,
    )

    private fun query(database: IsolatedPostgresDatabase, sql: String): String = DriverManager.getConnection(
        database.jdbcUrl,
        database.username,
        database.password,
    ).use { connection ->
        connection.createStatement().use { statement ->
            statement.executeQuery(sql).use { rows ->
                rows.next()
                rows.getString(1)
            }
        }
    }

    private fun JsonElement.field(name: String): String = jsonObject.getValue(name).jsonPrimitive.content
}
