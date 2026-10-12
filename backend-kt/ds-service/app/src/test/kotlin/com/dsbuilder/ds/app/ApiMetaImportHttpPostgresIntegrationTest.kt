package com.dsbuilder.ds.app

import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.DriverManager
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * The administrative API-meta import served by ds-service (change move-import-api-meta-to-ds-service):
 * access, body contract, additive writes, platform identity, deprecation of platform names and the journal.
 */
class ApiMetaImportHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `only a trusted system administrator is admitted and the role is checked before the body`() = withService {
        assertEquals(HttpStatusCode.OK, importMeta(body("compose", dryRun = true)).status)
        assertEquals(HttpStatusCode.Forbidden, importMeta(body("compose"), admin = false).status)
        // a refused caller never gets a 400 for a malformed body
        assertEquals(HttpStatusCode.Forbidden, importMeta("{}", admin = false).status)
        val noHeaders = service.builder.client.post(PATH) {
            contentType(ContentType.Application.Json)
            setBody(body("compose"))
        }
        assertEquals(HttpStatusCode.Forbidden, noHeaders.status)
        val notTrue = service.builder.client.post(PATH) {
            actor(administrator = true)
            header("X-System-Admin", "yes")
            contentType(ContentType.Application.Json)
            setBody(body("compose"))
        }
        assertEquals(HttpStatusCode.Forbidden, notTrue.status)
        assertEquals(0, count("components"))
    }

    @Test
    fun `the body contract is enforced`() = withService {
        val bad = listOf(
            "{}",
            """{"platform":"android","components":[{"name":"A"}]}""",
            """{"platform":"compose","components":[]}""",
            """{"platform":"compose","components":[{"name":"","properties":[]}]}""",
            component("compose", """{"name":"x","type":"color"}"""),
            component("compose", """{"name":"x","type":"color","platformNames":[]}"""),
            component("compose", prop("x", "color", """[{"name":"x","deprecated":{"message":5}}]""")),
            component("compose", """{"name":"x","type":"color","platformNames":[{"deprecated":{"message":"m"}}]}"""),
        )
        bad.forEach { assertEquals(HttpStatusCode.BadRequest, importMeta(it).status, it) }
        val ok = importMeta(
            component("compose", prop("x", "color", """[{"name":"x","deprecated":{"message":""}}]""")),
        )
        assertEquals(HttpStatusCode.OK, ok.status, ok.bodyAsText())
    }

    @Test
    fun `creates components properties states and names and a repeat creates nothing`() = withService {
        val request = body(
            "compose",
            dryRun = false,
            components = """[{"name":"Avatar","states":["hovered","pressed"],"properties":[
                {"name":"shape","type":"shape","platformNames":["shape"]},
                {"name":"width","type":"dimension","platformNames":["minWidth","maxWidth"]}]}]""",
        )
        val first = importMeta(request).report()
        assertEquals(listOf(1, 2, 2, 3, 0), first.ints(*CREATED))
        assertEquals(1, count("components WHERE name = 'Avatar' AND platform = 'compose'"))
        assertEquals(3, count("property_platform_params WHERE platform = 'compose'"))
        assertEquals(2, count("states WHERE component_id IS NOT NULL"))

        val second = importMeta(request).report()
        assertEquals(listOf(0, 0, 0, 0, 2), second.ints(*CREATED))
        assertEquals(3, count("property_platform_params"))
    }

    @Test
    fun `a dry run reports what an applied import does and stores nothing`() = withService {
        val applied = componentsBody("compose", dryRun = false)
        val dry = importMeta(componentsBody("compose", dryRun = true)).report()
        assertEquals(0, count("components"))
        assertEquals(0, count("design_system_changes"))
        val real = importMeta(applied).report()
        assertEquals(dry, real)
    }

    @Test
    fun `an existing property keeps its type and an unknown type rejects only that property`() = withService {
        importMeta(component("compose", """{"name":"fill","type":"color","platformNames":["fill"]}""", dryRun = false))
        val report = importMeta(
            component(
                "compose",
                """{"name":"fill","type":"shape","platformNames":["fill","fillAlt"]},
                   {"name":"odd","type":"gizmo","platformNames":["odd"]},
                   {"name":"ok","type":"float","platformNames":["ok"]}""",
                dryRun = false,
            ),
        ).report()
        assertEquals(listOf("A.fill: db=color, meta=shape"), report.strings("typeMismatches"))
        val rejected = report.getValue("rejected").jsonArray.single().jsonObject
        assertEquals("odd", rejected.getValue("property").jsonPrimitive.content)
        assertTrue(rejected.getValue("reason").jsonPrimitive.content.startsWith("unknown property type"))
        assertEquals("color", query("SELECT type::text FROM properties WHERE name = 'fill'"))
        assertEquals(1, count("properties WHERE name = 'ok'"))
        assertEquals(1, count("property_platform_params WHERE name = 'fillAlt'"))
        assertEquals(0, count("properties WHERE name = 'odd'"))
    }

    @Test
    fun `components of different platforms are independent`() = withService {
        importMeta(component("compose", """{"name":"p","type":"color","platformNames":["p"]}""", dryRun = false))
        val xml = importMeta(component("xml", prop("p", "dimension", """["android:p"]"""), dryRun = false)).report()
        assertEquals(listOf(1, 1), xml.ints("createdComponents", "createdProperties"))
        assertTrue(xml.strings("typeMismatches").isEmpty())
        assertEquals(2, count("components WHERE name = 'A'"))
        assertEquals("color", typeOn("compose"))
        assertEquals("dimension", typeOn("xml"))
    }

    @Test
    fun `repeats of one property are merged and a contradicting type is rejected`() = withService {
        val report = importMeta(
            component(
                "compose",
                """{"name":"w","type":"dimension","platformNames":["a"]},
                   {"name":"w","type":"dimension","platformNames":["b"]},
                   {"name":"w","type":"color","platformNames":["c"]}""",
                dryRun = false,
            ),
        ).report()
        assertEquals(listOf(1, 2), report.ints("createdProperties", "createdAliases"))
        assertEquals(1, report.getValue("rejected").jsonArray.size)
    }

    @Test
    fun `the earlier single platformName field is accepted and platformNames wins`() = withService {
        importMeta(component("compose", """{"name":"legacy","type":"color","platformName":"old"}""", dryRun = false))
        assertEquals(1, count("property_platform_params WHERE name = 'old'"))
        val both = """{"name":"both","type":"color","platformName":"old2","platformNames":["new2"]}"""
        importMeta(component("compose", both, dryRun = false))
        assertEquals(0, count("property_platform_params WHERE name = 'old2'"))
        assertEquals(1, count("property_platform_params WHERE name = 'new2'"))
    }

    @Test
    fun `deprecation of a platform name is set, changed, cleared and left alone by a string`() = withService {
        suspend fun send(names: String) =
            importMeta(component("compose", prop("s", "shape", names), dryRun = false)).report()

        val created = send("""[{"name":"shape","deprecated":{"message":"use X"}}]""")
        assertEquals(listOf(1, 1), created.ints("createdAliases", "deprecatedMarked"))
        assertEquals("use X", query("SELECT deprecated_message FROM property_platform_params WHERE name = 'shape'"))

        val useY = """[{"name":"shape","deprecated":{"message":"use Y"}}]"""
        assertEquals(listOf(0, 1, 0), send(useY).ints(*DEPRECATION))
        assertEquals(listOf(0, 0, 0), send("""["shape"]""").ints(*DEPRECATION))
        assertEquals("true", query("SELECT deprecated::text FROM property_platform_params WHERE name = 'shape'"))
        assertEquals(listOf(0, 0, 0), send(useY).ints(*DEPRECATION))

        assertEquals(listOf(0, 0, 1), send("""[{"name":"shape"}]""").ints(*DEPRECATION))
        assertEquals("false", query("SELECT deprecated::text FROM property_platform_params WHERE name = 'shape'"))
        assertEquals(0, count("property_platform_params WHERE deprecated_message IS NOT NULL"))

        // a deprecation without a message still means "deprecated"
        send("""[{"name":"shape","deprecated":{"message":""}}]""")
        assertEquals("", query("SELECT deprecated_message FROM property_platform_params WHERE name = 'shape'"))
    }

    @Test
    fun `a dry run shows the deprecation but does not change the status`() = withService {
        importMeta(component("compose", """{"name":"s","type":"shape","platformNames":["shape"]}""", dryRun = false))
        val dry = importMeta(
            component(
                "compose",
                prop("s", "shape", """[{"name":"shape","deprecated":{"message":"m"}}]"""),
                dryRun = true,
            ),
        ).report()
        assertEquals(1, dry.ints("deprecatedMarked").single())
        assertEquals("false", query("SELECT deprecated::text FROM property_platform_params WHERE name = 'shape'"))
    }

    @Test
    fun `absent lists what is stored for the platform but missing from the meta`() = withService {
        importMeta(
            body(
                "compose",
                dryRun = false,
                components = """[{"name":"Keep","properties":[${prop("a", "color", """["a"]""")},""" +
                    """${prop("b", "color", """["b"]""")}]},""" +
                    """{"name":"Gone","properties":[${prop("x", "color", """["x"]""")}]}]""",
            ),
        )
        importMeta(component("xml", prop("z", "color", """["z"]"""), dryRun = false, name = "OtherPlatform"))
        val report = importMeta(
            body(
                "compose",
                dryRun = true,
                components = """[{"name":"Keep","properties":[${prop("a", "color", """["a"]""")}]}]""",
            ),
        ).report()
        assertEquals(listOf("Gone", "Keep.b"), report.strings("absent"))
        assertEquals(1, count("properties WHERE name = 'b'"))
    }

    @Test
    fun `an applied import writes one journal row without a design system and no component links`() = withService {
        importMeta(componentsBody("compose", dryRun = false, source = "C:\\tmp\\dir/uikit-compose-api-meta.json"))
        assertEquals(1, count("design_system_changes"))
        assertEquals("components:import-api-meta", query("SELECT entity_type FROM design_system_changes"))
        assertEquals("true", query("SELECT (design_system_id IS NULL)::text FROM design_system_changes"))
        assertEquals("created", query("SELECT operation::text FROM design_system_changes"))
        assertEquals("uikit-compose-api-meta.json", query("SELECT data->>'source' FROM design_system_changes"))
        assertEquals("false", query("SELECT data->>'dryRun' FROM design_system_changes"))
        assertEquals("compose", query("SELECT data->>'platform' FROM design_system_changes"))
        assertEquals("integration-admin", query("SELECT data->>'userId' FROM design_system_changes"))
        assertEquals(0, count("design_system_components"))

        importMeta(componentsBody("compose", dryRun = false))
        val latest = query("SELECT operation::text FROM design_system_changes ORDER BY created_at DESC LIMIT 1")
        assertEquals("updated", latest)
        assertFalse(importMeta(componentsBody("compose", dryRun = true)).bodyAsText().isEmpty())
        assertEquals(2, count("design_system_changes"))
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────

    private fun componentsBody(platform: String, dryRun: Boolean, source: String = "meta.json") = component(
        platform,
        prop("shape", "shape", """["shape"]""") + "," + prop("fill", "color", """["fill"]"""),
        dryRun = dryRun,
        source = source,
    )

    private fun component(
        platform: String,
        properties: String,
        dryRun: Boolean = true,
        name: String = "A",
        source: String = "meta.json",
    ) = body(platform, dryRun, """[{"name":"$name","properties":[$properties]}]""", source)

    private fun body(
        platform: String,
        dryRun: Boolean = true,
        components: String = """[{"name":"A","properties":[{"name":"p","type":"color","platformNames":["p"]}]}]""",
        source: String = "meta.json",
    ) = """{"platform":"$platform","meta":{"source":${JsonPrimitive(source)}},""" +
        """"dryRun":$dryRun,"components":$components}"""

    private fun prop(name: String, type: String, names: String) =
        """{"name":"$name","type":"$type","platformNames":$names}"""

    private fun typeOn(platform: String) = query(
        "SELECT p.type::text FROM properties p JOIN components c ON c.id = p.component_id " +
            "WHERE c.platform = '$platform'",
    )

    private suspend fun importMeta(body: String, admin: Boolean = true) = service.builder.client.post(PATH) {
        actor(administrator = admin)
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private fun HttpRequestBuilder.actor(administrator: Boolean) {
        header("X-Actor-Type", "user")
        header("X-User-Id", if (administrator) "integration-admin" else "integration-user")
        header("X-Project-Id", if (administrator) "global" else "project-a")
        if (!administrator) header("X-Project-Role", "owner")
        header("X-System-Admin", administrator.toString())
    }

    private suspend fun HttpResponse.report(): JsonObject {
        assertEquals(HttpStatusCode.OK, status, bodyAsText())
        return json.parseToJsonElement(bodyAsText()).jsonObject
    }

    private fun JsonObject.ints(vararg names: String) = names.map { getValue(it).jsonPrimitive.int }

    private fun JsonObject.strings(name: String) = (getValue(name) as JsonArray).map { it.jsonPrimitive.content }

    // ── harness ───────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: PostgreSQLContainer<Nothing>, val builder: ApplicationTestBuilder)

    private lateinit var service: Service

    private fun withService(body: suspend ApiMetaImportHttpPostgresIntegrationTest.() -> Unit) {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            testApplication {
                application { module(configuration(postgres)) }
                service = Service(postgres, this)
                kotlinx.coroutines.runBlocking { body() }
            }
        }
    }

    private fun configuration(postgres: PostgreSQLContainer<Nothing>) = DsServiceConfiguration(
        port = 0,
        databaseUrl = postgres.jdbcUrl,
        databaseUser = postgres.username,
        databasePassword = postgres.password,
        databasePoolSize = 4,
        databaseConnectionTimeoutMs = 5_000,
        authorizationPolicyPath = null,
        runFlyway = true,
        adoptExistingSchema = false,
        expectedSchemaFingerprint = null,
    )

    private fun count(tableAndWhere: String): Int = query("SELECT count(*) FROM $tableAndWhere").toInt()

    private fun query(sql: String): String =
        DriverManager.getConnection(
            service.postgres.jdbcUrl,
            service.postgres.username,
            service.postgres.password,
        ).use {
            it.createStatement().use { statement ->
                statement.executeQuery(sql).use { rows ->
                    rows.next()
                    rows.getString(1)
                }
            }
        }

    private companion object {
        const val PATH = "/api/ds/admin/component-config/import-api-meta"
        val CREATED = arrayOf(
            "createdComponents",
            "createdProperties",
            "createdStates",
            "createdAliases",
            "unchangedProperties",
        )
        val DEPRECATION = arrayOf("deprecatedMarked", "deprecatedMessageChanged", "deprecatedCleared")
    }
}
