package com.dsbuilder.ds.app

import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * Platform identity of components, deprecated platform names and the platform-aware component-config routes
 * (change split-component-platforms-and-api-deprecated, mirrored from db-service).
 */
class ComponentPlatformHttpPostgresIntegrationTest {
    private val json = Json { ignoreUnknownKeys = false }

    @Test
    fun `a component is identified by its name and platform`() = withService {
        val missing = post("/api/ds/components", """{"name":"Avatar"}""", admin = true)
        val invalid = post("/api/ds/components", """{"name":"Avatar","platform":"android"}""", admin = true)
        assertEquals(HttpStatusCode.BadRequest, missing.status)
        assertEquals(HttpStatusCode.BadRequest, invalid.status)

        val compose = post("/api/ds/components", """{"name":"Avatar","platform":"compose"}""", admin = true)
        val xml = post("/api/ds/components", """{"name":"Avatar","platform":"xml"}""", admin = true)
        assertEquals(HttpStatusCode.Created, compose.status, compose.bodyAsText())
        assertEquals(HttpStatusCode.Created, xml.status, xml.bodyAsText())
        assertEquals("compose", field(compose.bodyAsText(), "platform"))
        assertEquals("xml", field(xml.bodyAsText(), "platform"))
        assertNotEquals(id(compose.bodyAsText()), id(xml.bodyAsText()))

        val duplicate = post("/api/ds/components", """{"name":"Avatar","platform":"compose"}""", admin = true)
        assertTrue(duplicate.status.value >= 400, "a duplicate (name, platform) must be rejected: ${duplicate.status}")
        assertEquals(2, count("components WHERE name = 'Avatar'"))
    }

    @Test
    fun `the platform of a property alias follows its component and deprecation is stored per alias`() = withService {
        val component =
            id(post("/api/ds/components", """{"name":"Toast","platform":"xml"}""", admin = true).bodyAsText())
        val property = id(
            post(
                "/api/ds/properties",
                """{"componentId":"$component","name":"textColor","type":"color"}""",
                admin = true,
            )
                .bodyAsText(),
        )
        val designSystem =
            id(post("/api/ds/design-systems", """{"name":"toast","projectName":"toast"}""", owner = true).bodyAsText())
        val linked = post(
            "/api/ds/design-system-components",
            """{"designSystemId":"$designSystem","componentId":"$component"}""",
            admin = true,
        )
        assertEquals(HttpStatusCode.Created, linked.status, linked.bodyAsText())
        val variation = id(
            post(
                "/api/ds/variations",
                """{"designSystemId":"$designSystem","componentId":"$component","name":"view"}""",
                admin = true,
            ).bodyAsText(),
        )
        val propertyVariationBody = """{"propertyId":"$property","variationId":"$variation"}"""
        val propertyVariation = post(
            "/api/ds/property-variations",
            propertyVariationBody,
            admin = true,
            idempotencyKey = "property-variation-replay",
        )
        val replayedPropertyVariation = post(
            "/api/ds/property-variations",
            propertyVariationBody,
            admin = true,
            idempotencyKey = "property-variation-replay",
        )
        assertEquals(HttpStatusCode.Created, propertyVariation.status, propertyVariation.bodyAsText())
        assertEquals(propertyVariation.status, replayedPropertyVariation.status)
        assertEquals(propertyVariation.bodyAsText(), replayedPropertyVariation.bodyAsText())

        val created = post(
            "/api/ds/property-platform-params",
            """{"propertyId":"$property","platform":"xml","name":"sd_textColor","deprecated":true,""" +
                """"deprecatedMessage":"Use android:textColor"}""",
            admin = true,
            idempotencyKey = "property-platform-param-replay",
        )
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        val replayed = post(
            "/api/ds/property-platform-params",
            """{"propertyId":"$property","platform":"xml","name":"sd_textColor","deprecated":true,""" +
                """"deprecatedMessage":"Use android:textColor"}""",
            admin = true,
            idempotencyKey = "property-platform-param-replay",
        )
        assertEquals(created.status, replayed.status)
        assertEquals(created.bodyAsText(), replayed.bodyAsText())
        val alias = id(created.bodyAsText())
        assertTrue(
            json.parseToJsonElement(created.bodyAsText()).jsonObject.getValue("deprecated").jsonPrimitive.boolean,
        )
        assertEquals("Use android:textColor", field(created.bodyAsText(), "deprecatedMessage"))

        val plain = post(
            "/api/ds/property-platform-params",
            """{"propertyId":"$property","platform":"xml","name":"android:textColor"}""",
            admin = true,
        )
        assertEquals(HttpStatusCode.Created, plain.status, plain.bodyAsText())
        val plainBody = json.parseToJsonElement(plain.bodyAsText()).jsonObject
        assertFalse(plainBody.getValue("deprecated").jsonPrimitive.boolean)
        assertTrue(plainBody.getValue("deprecatedMessage") is JsonNull)

        val clearedMessage = patch(
            "/api/ds/property-platform-params/$alias",
            """{"deprecated":false,"deprecatedMessage":null}""",
        )
        assertEquals(HttpStatusCode.OK, clearedMessage.status, clearedMessage.bodyAsText())
        assertTrue(
            json.parseToJsonElement(clearedMessage.bodyAsText()).jsonObject.getValue("deprecatedMessage") is JsonNull,
        )

        val emptyMessage =
            patch("/api/ds/property-platform-params/$alias", """{"deprecated":true,"deprecatedMessage":""}""")
        assertEquals("", field(emptyMessage.bodyAsText(), "deprecatedMessage"))

        val messageWithoutMark = patch(
            "/api/ds/property-platform-params/$alias",
            """{"deprecated":false,"deprecatedMessage":"still here"}""",
        )
        assertTrue(messageWithoutMark.status.value >= 400, "a message without the mark violates the check constraint")

        val foreign = post(
            "/api/ds/property-platform-params",
            """{"propertyId":"$property","platform":"web","name":"x"}""",
            admin = true,
        )
        assertTrue(foreign.status.value >= 400, "an alias of another platform must be rejected: ${foreign.status}")
        assertEquals(2, count("property_platform_params WHERE property_id = '$property'"))
    }

    @Test
    fun `state set resolution replays the original status and body`() = withService {
        val state = post(
            "/api/ds/states",
            """{"name":"replay-state"}""",
            admin = true,
        )
        assertEquals(HttpStatusCode.Created, state.status, state.bodyAsText())
        val body = """{"stateIds":["${id(state.bodyAsText())}"]}"""
        val first = post(
            "/api/ds/state-sets/resolve",
            body,
            admin = true,
            idempotencyKey = "state-set-replay",
        )
        val replay = post(
            "/api/ds/state-sets/resolve",
            body,
            admin = true,
            idempotencyKey = "state-set-replay",
        )

        assertEquals(HttpStatusCode.Created, first.status, first.bodyAsText())
        assertEquals(first.status, replay.status)
        assertEquals(first.bodyAsText(), replay.bodyAsText())
    }

    @Test
    fun `component config is read written and exported per platform`() = withService {
        val designSystem =
            id(post("/api/ds/design-systems", """{"name":"alpha","projectName":"alpha"}""", owner = true).bodyAsText())
        val web = id(post("/api/ds/components", """{"name":"Button","platform":"web"}""", admin = true).bodyAsText())
        val compose =
            id(post("/api/ds/components", """{"name":"Button","platform":"compose"}""", admin = true).bodyAsText())
        for (component in listOf(web, compose)) {
            post("/api/ds/properties", """{"componentId":"$component","name":"shape","type":"value"}""", admin = true)
        }
        post(
            "/api/ds/design-system-versions",
            """{"designSystemId":"$designSystem","version":"1.0.0","snapshot":{},"publicationStatus":"published"}""",
            owner = true,
        )

        val withoutPlatform =
            post("/api/ds/component-config/import", importBody(designSystem, platform = null), editor = true)
        assertEquals(HttpStatusCode.BadRequest, withoutPlatform.status)
        val wrongPlatform =
            post("/api/ds/component-config/import", importBody(designSystem, platform = "android"), editor = true)
        assertEquals(HttpStatusCode.BadRequest, wrongPlatform.status)

        val imported =
            post("/api/ds/component-config/import", importBody(designSystem, platform = "compose"), editor = true)
        assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
        assertEquals("1", field(imported.bodyAsText(), "created"))
        assertEquals(1, count("appearances WHERE component_id = '$compose'"))
        assertEquals(0, count("appearances WHERE component_id = '$web'"))

        val missingPlatformRead =
            get("/api/ds/component-config?ds=alpha&version=1.0.0&appearance=default&component=Button")
        assertEquals(HttpStatusCode.BadRequest, missingPlatformRead.status)
        val composeRead = get(
            "/api/ds/component-config?ds=alpha&version=1.0.0&appearance=default&component=Button&platform=compose",
        )
        assertEquals(HttpStatusCode.OK, composeRead.status, composeRead.bodyAsText())
        val webRead =
            get("/api/ds/component-config?ds=alpha&version=1.0.0&appearance=default&component=Button&platform=web")
        assertEquals(HttpStatusCode.NotFound, webRead.status)

        val noNative =
            post("/api/ds/component-config/import", importBody(designSystem, platform = "ios"), editor = true)
        assertEquals(HttpStatusCode.OK, noNative.status, noNative.bodyAsText())
        val rejected = json.parseToJsonElement(noNative.bodyAsText()).jsonObject.getValue("rejected").jsonArray
        assertEquals(1, rejected.size)
        assertTrue(rejected.single().jsonObject.getValue("reason").jsonPrimitive.content.contains("platform 'ios'"))

        val exportedCompose = post(
            "/api/ds/component-config/export",
            """{"designSystemId":"$designSystem","platform":"compose"}""",
            viewer = true,
        )
        val exportedWeb = post(
            "/api/ds/component-config/export",
            """{"designSystemId":"$designSystem","platform":"web"}""",
            viewer = true,
        )
        val exportedWithoutPlatform = post(
            "/api/ds/component-config/export",
            """{"designSystemId":"$designSystem"}""",
            viewer = true,
        )
        assertEquals(1, exportedCompose.entries())
        assertEquals(0, exportedWeb.entries())
        assertEquals(HttpStatusCode.BadRequest, exportedWithoutPlatform.status)
        assertEquals(null, queryNullable("SELECT to_regclass('public.design_system_changes')"))
    }

    @Test
    fun `a repeated state in one property collapses to the last value`() = withService {
        val designSystem =
            id(post("/api/ds/design-systems", """{"name":"beta","projectName":"beta"}""", owner = true).bodyAsText())
        val component =
            id(post("/api/ds/components", """{"name":"Button","platform":"compose"}""", admin = true).bodyAsText())
        post("/api/ds/properties", """{"componentId":"$component","name":"color","type":"color"}""", admin = true)
        val body = importBody(designSystem, platform = "compose").replace(
            """"shape":{"type":"value","value":{"radius":8}}""",
            """"color":{"type":"color","default":"a","states":[""" +
                """{"state":["hovered"],"value":"b"},{"state":["hovered"],"value":"c"}]}""",
        )
        val imported = post("/api/ds/component-config/import", body, editor = true)
        assertEquals(HttpStatusCode.OK, imported.status, imported.bodyAsText())
        assertEquals("1", field(imported.bodyAsText(), "created"))
        assertEquals(2, count("invariant_property_values"))
    }

    @Test
    fun `declared cross-axis coordinates are stored in a canonical order whatever the order of the entries`() =
        withService {
            val designSystem = id(
                post("/api/ds/design-systems", """{"name":"gamma","projectName":"gamma"}""", owner = true).bodyAsText(),
            )
            val component =
                id(post("/api/ds/components", """{"name":"Button","platform":"compose"}""", admin = true).bodyAsText())
            post("/api/ds/properties", """{"componentId":"$component","name":"gap","type":"value"}""", admin = true)
            fun entry(
                size: String,
            ) = """{"name":"default","targets":[{"properties":[{"id":"size","value":"$size"}]}],""" +
                """"properties":{"gap":{"type":"value","value":1}}}"""

            fun body(first: String, second: String) = importBody(designSystem, platform = "compose").replace(
                """"config":{"invariants":{"shape":{"type":"value","value":{"radius":8}}}}""",
                """"config":{"variations":[{"id":"size","name":"size","values":[{"name":"l"},{"name":"m"}]},""" +
                    """{"id":"view","name":"view","values":[${entry(first)},${entry(second)}]}]}""",
            )

            val members =
                "WITH combinations AS (SELECT * FROM (SELECT DISTINCT ON (appearance_combination_id) * " +
                    "FROM appearance_combination_revisions ORDER BY appearance_combination_id, " +
                    "version_sequence_number DESC) latest WHERE NOT deleted), " +
                    "members AS (SELECT * FROM (SELECT DISTINCT ON (appearance_combination_member_id) * " +
                    "FROM appearance_combination_member_revisions ORDER BY appearance_combination_member_id, " +
                    "version_sequence_number DESC) latest WHERE NOT deleted), " +
                    "styles_resolved AS (SELECT * FROM (SELECT DISTINCT ON (style_id) * FROM style_revisions " +
                    "ORDER BY style_id, version_sequence_number DESC) latest WHERE NOT deleted) " +
                    "SELECT string_agg(k, ';' ORDER BY p) FROM (SELECT combination.position AS p, " +
                    "(SELECT string_agg(style_revision.name, '+' ORDER BY member.position) " +
                    "FROM appearance_combination_members member_entity " +
                    "JOIN members member ON member.appearance_combination_member_id = member_entity.id " +
                    "JOIN styles_resolved style_revision ON style_revision.style_id = member.style_id " +
                    "WHERE member_entity.appearance_combination_id = combination_entity.id) AS k " +
                    "FROM appearance_combinations combination_entity JOIN combinations combination " +
                    "ON combination.appearance_combination_id = combination_entity.id) result"

            val first = post("/api/ds/component-config/import", body("l", "m"), editor = true)
            assertEquals(HttpStatusCode.OK, first.status, first.bodyAsText())
            assertTrue(count("appearance_combinations") > 0, first.bodyAsText())
            val stored = query(members)
            val again = post("/api/ds/component-config/import", body("m", "l"), editor = true)

            assertEquals("1", field(again.bodyAsText(), "unchanged"), again.bodyAsText())
            assertEquals(stored, query(members))
        }

    @Test
    fun `client managed journal routes are absent`() = withService {
        assertEquals(HttpStatusCode.NotFound, get("/api/ds/design-system-changes", viewer = true).status)
        assertEquals(
            HttpStatusCode.NotFound,
            get("/api/ds/design-system-changes/by-design-system/${UUID.randomUUID()}", viewer = true).status,
        )
    }

    @Test
    fun `import preserves values references states and platform parameters`() = withService {
        val ds = id(
            post(
                "/api/ds/design-systems",
                """{"name":"identity","projectName":"identity"}""",
                owner = true,
            ).bodyAsText(),
        )
        val button = id(
            post(
                "/api/ds/components",
                """{"name":"Button","platform":"compose"}""",
                admin = true,
            ).bodyAsText(),
        )
        post("/api/ds/components", """{"name":"Icon","platform":"compose"}""", admin = true)
        val gap = id(
            post(
                "/api/ds/properties",
                """{"componentId":"$button","name":"gap","type":"value"}""",
                admin = true,
            ).bodyAsText(),
        )
        post(
            "/api/ds/properties",
            """{"componentId":"$button","name":"content","type":"component_style"}""",
            admin = true,
        )
        val alias = id(
            post(
                "/api/ds/property-platform-params",
                """{"propertyId":"$gap","platform":"compose","name":"gapAlias"}""",
                admin = true,
            ).bodyAsText(),
        )
        fun entry(values: String, reversed: Boolean): String {
            val hover = """{"state":["hovered"],"value":3}"""
            val pressed = """{"state":["pressed"],"value":4}"""
            val states = if (reversed) "$pressed,$hover" else "$hover,$pressed"
            val property = """{"type":"value","value":$values,"states":[$states]}"""
            return """{"componentName":"button","styleName":"default","config":{"invariants":{
                "gap":$property,"content":{"type":"component_style","value":"icon.small"}},
                "variations":[{"id":"size","name":"size","values":[{"name":"l","properties":{"gap":$property}}]},
                {"id":"view","name":"view","values":[{"name":"default","targets":[{"properties":[
                {"id":"size","value":"l"}]}],"properties":{"gap":$property}}]}]}}""".replace("\n", "")
        }
        val icon = """{"componentName":"icon","styleName":"icon","config":{"variations":[
            {"id":"size","name":"size","values":[{"name":"small"}]}]}}""".replace("\n", "")
        fun body(vararg entries: String) = """{"designSystemId":"$ds","platform":"compose","dryRun":false,
            "meta":{"name":"fixture","source":"test"},"components":[${entries.joinToString(",")}] }"""
        suspend fun load(value: String) = post("/api/ds/component-config/import", value, editor = true).also {
            assertEquals(HttpStatusCode.OK, it.status, it.bodyAsText())
        }
        val initial = body(entry("[1,2]", false), icon)
        val report = load(initial)
        assertEquals("2", field(report.bodyAsText(), "created"), report.bodyAsText())
        assertEquals(
            "[]",
            json.parseToJsonElement(report.bodyAsText()).jsonObject["unresolvedComponentStyles"].toString(),
        )
        val values = get("/api/ds/invariant-property-values")
        val stateValue = requireNotNull(
            json.parseToJsonElement(values.bodyAsText()).jsonArray.firstOrNull {
                it.jsonObject["value"]?.jsonPrimitive?.content == "3"
            },
        ) { values.bodyAsText() + " report=" + report.bodyAsText() }.jsonObject.getValue("id").jsonPrimitive.content
        val adjustment = post(
            "/api/ds/invariant-platform-param-adjustments",
            """{"ipvId":"$stateValue","platformParamId":"$alias","template":"a ${'$'}1"}""",
            editor = true,
        )
        assertEquals(HttpStatusCode.Created, adjustment.status, adjustment.bodyAsText())
        val draft = json.parseToJsonElement(get("/api/ds/design-systems/$ds").bodyAsText()).jsonObject
        val published = post(
            "/api/ds/design-system-versions",
            """{"designSystemId":"$ds","draftId":${draft.getValue("draftId")},""" +
                """"draftRevision":${draft.getValue("draftRevision")},"version":"1.0.0"}""",
            owner = true,
            idempotencyKey = "identity-publication",
        )
        assertEquals(HttpStatusCode.Created, published.status, published.bodyAsText())
        val versionId = id(published.bodyAsText())
        val before = importedState(includeRevisions = true)
        load(initial)
        assertEquals(before, importedState(includeRevisions = true))
        val identities = importedState(includeRevisions = false)
        val changed = body(entry("[2,3]", true), icon)
        load(changed)
        assertEquals(identities, importedState(includeRevisions = false))
        val adjustmentPath = "/api/ds/invariant-platform-param-adjustments/${id(adjustment.bodyAsText())}"
        assertEquals(HttpStatusCode.OK, get(adjustmentPath).status)
        val valuePath = "/api/ds/invariant-property-values/$stateValue"
        assertEquals("1", field(get("$valuePath?versionId=$versionId").bodyAsText(), "position"))
        assertEquals("2", field(get(valuePath).bodyAsText(), "position"))
        val after = importedState(includeRevisions = true)
        load(changed)
        assertEquals(after, importedState(includeRevisions = true))
        execute(
            """
            CREATE FUNCTION fail_identity_import() RETURNS trigger LANGUAGE plpgsql AS ${'$'}${'$'}
            BEGIN
                IF NEW.value::jsonb = '[9,9]'::jsonb THEN RAISE EXCEPTION 'injected_import_failure'; END IF;
                RETURN NEW;
            END; ${'$'}${'$'};
            CREATE TRIGGER fail_identity_import BEFORE INSERT ON variation_property_value_revisions
            FOR EACH ROW EXECUTE FUNCTION fail_identity_import();
            """.trimIndent(),
        )
        val failed = post("/api/ds/component-config/import", body(entry("[9,9]", false), icon), editor = true)
        assertTrue(failed.status.value >= 400, failed.bodyAsText())
        assertEquals(after, importedState(includeRevisions = true))
        execute("DROP TRIGGER fail_identity_import ON variation_property_value_revisions")
        execute("DROP FUNCTION fail_identity_import()")
        val empty = """{"componentName":"button","styleName":"default","config":{}}"""
        load(body(entry("[2,3]", true), empty, icon))
        assertEquals("[]", get("/api/ds/invariant-property-values").bodyAsText())
        assertEquals(
            "0",
            query(
                "SELECT count(*) FROM (SELECT DISTINCT ON (component_style_reference_id) deleted " +
                    "FROM component_style_reference_revisions " +
                    "ORDER BY component_style_reference_id, version_sequence_number DESC) latest WHERE NOT deleted",
            ),
        )
        assertEquals(HttpStatusCode.OK, get("$valuePath?versionId=$versionId").status)
        assertEquals(HttpStatusCode.OK, get("$adjustmentPath?versionId=$versionId").status)
    }

    private fun importedState(includeRevisions: Boolean): List<String> {
        val stable = listOf(
            "appearances",
            "appearance_variations",
            "appearance_variation_values",
            "styles",
            "appearance_combinations",
            "appearance_combination_members",
            "invariant_property_values",
            "variation_property_values",
            "style_combinations",
            "style_combination_members",
            "component_style_references",
            "component_style_reference_styles",
            "invariant_platform_param_adjustments",
        )
        val revisions = listOf(
            "appearance_revisions",
            "appearance_variation_revisions",
            "appearance_variation_value_revisions",
            "style_revisions",
            "appearance_combination_revisions",
            "appearance_combination_member_revisions",
            "invariant_property_value_revisions",
            "variation_property_value_revisions",
            "style_combination_revisions",
            "style_combination_member_revisions",
            "component_style_reference_revisions",
            "component_style_reference_style_revisions",
            "invariant_platform_param_adjustment_revisions",
            "entity_edit_states",
            "entity_edit_paths",
            "draft_transaction_markers",
        )
        return (stable + if (includeRevisions) revisions else emptyList()).map { table ->
            query(
                "SELECT COALESCE(string_agg(to_jsonb(row)::text, ';' ORDER BY to_jsonb(row)::text), '') " +
                    "FROM $table row",
            )
        }
    }

    private suspend fun io.ktor.client.statement.HttpResponse.entries(): Int =
        json.parseToJsonElement(bodyAsText()).jsonObject.getValue("components").jsonArray.size

    private fun importBody(designSystemId: String, platform: String?) =
        """
        {
          "designSystemId":"$designSystemId",
          ${platform?.let { "\"platform\":\"$it\"," } ?: ""}
          "meta":{"name":"fixture","source":"kotlin-test"},
          "dryRun":false,
          "components":[{
            "componentName":"button",
            "styleName":"default",
            "config":{"invariants":{"shape":{"type":"value","value":{"radius":8}}}}
          }]
        }
        """.trimIndent()

    // ── harness ────────────────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: IsolatedPostgresDatabase, val builder: ApplicationTestBuilder)

    private lateinit var service: Service

    private fun withService(body: suspend ComponentPlatformHttpPostgresIntegrationTest.() -> Unit) {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                service = Service(postgres, this)
                kotlinx.coroutines.runBlocking { body() }
            }
        }
    }

    private suspend fun post(
        path: String,
        body: String,
        admin: Boolean = false,
        owner: Boolean = false,
        editor: Boolean = false,
        viewer: Boolean = false,
        idempotencyKey: String? = null,
    ) = service.builder.client.post(path) {
        actor(admin, owner, editor, viewer)
        idempotencyKey?.let { header("Idempotency-Key", it) }
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun patch(path: String, body: String) = service.builder.client.patch(path) {
        actor(admin = true, owner = false, editor = false, viewer = false)
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun get(path: String, viewer: Boolean = true) = service.builder.client.get(path) {
        actor(admin = false, owner = false, editor = false, viewer = viewer)
    }

    private fun HttpRequestBuilder.actor(admin: Boolean, owner: Boolean, editor: Boolean, viewer: Boolean) {
        val role = when {
            owner -> "owner"
            editor -> "editor"
            viewer -> "viewer"
            else -> "viewer"
        }
        header("X-Actor-Type", "user")
        header("X-User-Id", if (admin) "integration-admin" else "integration-user")
        header("X-Project-Id", if (admin) "global" else "project-a")
        if (!admin) header("X-Project-Role", role)
        header("X-System-Admin", admin.toString())
    }

    private fun configuration(postgres: IsolatedPostgresDatabase) = DsServiceConfiguration(
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

    private fun id(body: String): String = field(body, "id")

    private fun field(body: String, name: String): String =
        json.parseToJsonElement(
            body,
        ).jsonObject.getValue(name).let { if (it is JsonNull) "null" else it.jsonPrimitive.content }

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

    private fun queryNullable(sql: String): String? =
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

    private fun execute(sql: String) {
        DriverManager.getConnection(
            service.postgres.jdbcUrl,
            service.postgres.username,
            service.postgres.password,
        ).use {
            it.createStatement().use { statement -> statement.execute(sql) }
        }
    }
}
