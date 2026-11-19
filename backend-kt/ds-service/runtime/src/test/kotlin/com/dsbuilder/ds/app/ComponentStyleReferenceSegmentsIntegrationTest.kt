@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.app

import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Ссылка `component_style` разрешается и по исходным идентификаторам (`authoredId`) значений и сочетаний целевого
 * оформления, а не только по именам значений вариаций (`resolve-component-style-reference-segments`).
 *
 * Цель `group` повторяет форму пакета `sdds_serv`: идентификатор вариации (`no-gap`, `l.no-gap.default`) не равен
 * значению биндинга (`gap = none`).
 */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class ComponentStyleReferenceSegmentsIntegrationTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `a reference written with variation identifiers is resolved and recorded`() = withService {
        seedGlobalLayer()
        val system = designSystem()

        val report = importPackage(system, listOf(group, parent("by-combination", "group.l.no-gap.default")))

        assertEquals(emptyList(), unresolved(report))
        assertEquals(mapOf("group.l.no-gap.default" to 3), references())
    }

    @Test
    fun `a reference to a single value is resolved by its authored identifier`() = withService {
        seedGlobalLayer()
        val system = designSystem()

        val report = importPackage(system, listOf(group, parent("by-value", "group.no-gap")))

        assertEquals(emptyList(), unresolved(report))
        assertEquals(mapOf("group.no-gap" to 1), references())
    }

    @Test
    fun `a mixed reference combines an authored identifier and a value name`() = withService {
        seedGlobalLayer()
        val system = designSystem()

        val report = importPackage(system, listOf(group, parent("mixed", "group.no-gap.default")))

        assertEquals(emptyList(), unresolved(report))
        assertEquals(mapOf("group.no-gap.default" to 2), references())
    }

    @Test
    fun `a reference written with value names keeps resolving as before`() = withService {
        seedGlobalLayer()
        val system = designSystem()

        val report = importPackage(system, listOf(group, parent("by-names", "group.l.none.default")))

        assertEquals(emptyList(), unresolved(report))
        assertEquals(mapOf("group.l.none.default" to 3), references())
    }

    @Test
    fun `a reference that no split of its tail covers stays unresolved and is not recorded`() = withService {
        seedGlobalLayer()
        val system = designSystem()

        val report = importPackage(
            system,
            listOf(group, parent("missing", "group.l.no-gap.missing"), parent("no-target", "nowhere.l")),
        )

        assertEquals(listOf("group.l.no-gap.missing", "nowhere.l"), unresolved(report).sorted())
        assertEquals(emptyMap(), references())
    }

    @Test
    fun `an authored identifier is compared exactly`() = withService {
        seedGlobalLayer()
        val system = designSystem()

        val report =
            importPackage(system, listOf(group, parent("case", "group.No-Gap"), parent("space", "group. no-gap")))

        assertEquals(listOf("group. no-gap", "group.No-Gap"), unresolved(report).sorted())
        assertEquals(emptyMap(), references())
    }

    @Test
    fun `reimporting the same package keeps the references unchanged`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        val entries =
            listOf(group, parent("by-combination", "group.l.no-gap.default"), parent("mixed", "group.no-gap.default"))

        importPackage(system, entries)
        val again = importPackage(system, entries)

        assertEquals(0, again.getValue("created").jsonPrimitive.content.toInt())
        assertEquals(0, again.getValue("updated").jsonPrimitive.content.toInt())
        assertEquals(mapOf("group.l.no-gap.default" to 3, "group.no-gap.default" to 2), references())
    }

    /** Выгрузка после импорта загружается обратно без изменений: ссылки, разрешённые по идентификаторам, сохраняются. */
    @Test
    fun `an export of the imported package is imported back unchanged`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        importPackage(
            system,
            listOf(group, parent("by-combination", "group.l.no-gap.default"), parent("mixed", "group.no-gap.default")),
        )

        val exported = service.builder.client.post("/api/design-systems/$system/component-config/export") {
            actor(administrator = false)
            contentType(ContentType.Application.Json)
            setBody("""{"platform":"compose"}""")
        }
        assertEquals(HttpStatusCode.OK, exported.status, exported.bodyAsText())
        // Выгрузка пишет ссылку так, как она записана в пакете, поэтому обратная загрузка снова идёт по идентификаторам.
        assertTrue("group.l.no-gap.default" in exported.bodyAsText(), "the export must keep the reference text")
        assertTrue("group.no-gap.default" in exported.bodyAsText(), "the export must keep the reference text")
        val components = json.parseToJsonElement(exported.bodyAsText()).jsonObject.getValue("components").jsonArray
        val back = importPackage(system, components.map { it.toString() })

        assertEquals(emptyList(), unresolved(back))
        assertEquals(0, back.getValue("created").jsonPrimitive.content.toInt())
        assertEquals(0, back.getValue("updated").jsonPrimitive.content.toInt())
        assertEquals(mapOf("group.l.no-gap.default" to 3, "group.no-gap.default" to 2), references())
    }

    /** Индекс идентификаторов строится по цели, а не по ссылке: рост числа ссылок не добавляет чтений сочетаний. */
    @Test
    fun `the combinations of a target are read the same number of times for any number of references`() = withService {
        seedGlobalLayer()
        val none = designSystem("references-none")
        val few = designSystem()
        val many = designSystem("references-many")
        fun parents(count: Int) = (1..count).map { parent("p$it", "group.l.no-gap.default") }
        fun combinationReads(delta: QueryCounter.Snapshot) =
            delta.byKind.filterKeys { it.startsWith("SELECT") && "appearance_combination" in it }.values.sum()

        QueryCounter.profile(true)
        try {
            val start = QueryCounter.snapshot()
            importPackage(none, listOf(group))
            val afterNone = QueryCounter.snapshot()
            importPackage(few, listOf(group) + parents(2))
            val afterFew = QueryCounter.snapshot()
            importPackage(many, listOf(group) + parents(30))
            val afterMany = QueryCounter.snapshot()
            assertTrue(
                combinationReads(afterFew - afterNone) > combinationReads(afterNone - start),
                "the index of the target must add reads of combinations to an import without references",
            )
            assertEquals(
                combinationReads(afterFew - afterNone),
                combinationReads(afterMany - afterFew),
                "reading the combinations of the target must not grow with the number of references",
            )
        } finally {
            QueryCounter.profile(false)
        }
        // Две дизайн-системы, по три стиля в каждой.
        assertEquals(mapOf("group.l.no-gap.default" to 6), references())
    }

    /** Сочетание, которое нельзя собрать из имён и идентификаторов значений: индекс сочетаний обязателен. */
    @Test
    fun `a reference is resolved by the authored identifier of a combination alone`() = withService {
        seedGlobalLayer()
        val system = designSystem()

        val report = importPackage(system, listOf(combinationOnly, parent("by-combination-only", "combo.x.y")))

        assertEquals(emptyList(), unresolved(report))
        assertEquals(mapOf("combo.x.y" to 3), references())
    }

    @Test
    fun `a value wins over a combination with the same authored identifier`() = withService {
        seedGlobalLayer()
        val system = designSystem()

        val report = importPackage(system, listOf(clash, parent("clash-ref", "clash.k")))

        assertEquals(emptyList(), unresolved(report))
        assertEquals(mapOf("clash.k" to 1), references())
    }

    @Test
    fun `two combinations with one authored identifier are not merged`() = withService {
        seedGlobalLayer()
        val system = designSystem()

        importPackage(system, listOf(duplicated, parent("dup-ref", "dup.d")))

        val styles = references().getValue("dup.d")
        assertTrue(styles in setOf(2, 3), "the styles of one combination, not of both: $styles")
    }

    @Test
    fun `an empty authored identifier addresses nothing`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        val empty =
            """{"componentName":"group","styleName":"empty","config":{"variations":[""" +
                """{"id":"gap","name":"gap","values":[{"name":"none","authoredId":""}]}]}}"""

        val report = importPackage(system, listOf(empty, parent("e1", "empty."), parent("e2", "empty..none")))

        assertEquals(listOf("empty.", "empty..none"), unresolved(report).sorted())
        assertEquals(emptyMap(), references())
    }

    @Test
    fun `a reference without a tail is recorded with no styles as before`() = withService {
        seedGlobalLayer()
        val system = designSystem()

        val report = importPackage(system, listOf(group, parent("whole", "group")))

        assertEquals(emptyList(), unresolved(report))
        assertEquals(mapOf("group" to 0), references())
    }

    /** Источники ссылки: значение вариации, сочетание стилей и значение с состоянием. */
    @Test
    fun `references of variation values, combinations and states are resolved by authored identifiers`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        val byVariation =
            """{"componentName":"parent","styleName":"by-variation","config":{"variations":[""" +
                """{"id":"mode","name":"mode","values":[{"name":"a","properties":{"content":""" +
                """{"type":"component_style","value":"group.no-gap"}}}]}]}}"""
        val byCombination =
            """{"componentName":"parent","styleName":"by-combo","config":{"variations":[""" +
                """{"id":"mode","name":"mode","values":[{"name":"a"}]},""" +
                """{"id":"tone","name":"tone","values":[{"name":"b","targets":[{"properties":[""" +
                """{"id":"mode","value":"a"}]}],"properties":{"content":""" +
                """{"type":"component_style","value":"group.l.no-gap.default"}}}]}]}}"""
        val byState =
            """{"componentName":"parent","styleName":"by-state","config":{"invariants":{"content":""" +
                """{"type":"component_style","value":"group.no-gap","states":[{"state":["hovered"],""" +
                """"value":"group.l.no-gap.default"}]}}}}"""

        val report = importPackage(system, listOf(group, byVariation, byCombination, byState))

        assertEquals(emptyList(), unresolved(report))
        assertEquals(mapOf("group.no-gap" to 1, "group.l.no-gap.default" to 3), references())
    }

    @Test
    fun `a target that already exists from an earlier import is found`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        importPackage(system, listOf(group))

        val report = importPackage(system, listOf(parent("later", "group.l.no-gap.default")))

        assertEquals(emptyList(), unresolved(report))
        assertEquals(mapOf("group.l.no-gap.default" to 3), references())
    }

    @Test
    fun `a reference stops resolving when the authored identifier of its target is renamed`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        val parent = parent("renamed", "group.no-gap")
        importPackage(system, listOf(group, parent))

        val renamed = group.replace(""""authoredId":"no-gap"""", """"authoredId":"gap-none"""")
        val report = importPackage(system, listOf(renamed, parent))

        assertEquals(listOf("group.no-gap"), unresolved(report))
        assertEquals(emptyMap(), references())
    }

    @Test
    fun `a dry run reports what an applied import reports and records no references`() = withService {
        seedGlobalLayer()
        val system = designSystem()
        val entries = listOf(group, parent("dry", "group.l.no-gap.default"), parent("dry-missing", "group.zzz"))

        val dry = importPackage(system, entries, dryRun = true)
        assertEquals(emptyMap(), references(), "a dry run must record no references")

        val applied = importPackage(system, entries)
        assertEquals(dry, applied, "a dry run must report exactly what the applied import reports")
        assertEquals(listOf("group.zzz"), unresolved(applied))
    }

    // ── corpus ─────────────────────────────────────────────────────────────────────────────────────

    /** Вариации цели: `size = l`, `gap = none` (идентификатор `no-gap`), `shape = default` (сочетание `l.no-gap.default`). */
    private val group =
        """{"componentName":"group","styleName":"group","config":{"variations":[""" +
            """{"id":"size","name":"size","values":[{"name":"l"}]},""" +
            """{"id":"gap","name":"gap","values":[{"name":"none","authoredId":"no-gap"}]},""" +
            """{"id":"shape","name":"shape","values":[{"name":"default","authoredId":"l.no-gap.default",""" +
            """"targets":[{"properties":[{"id":"size","value":"l"},{"id":"gap","value":"none"}]}]}]}]}}"""

    /** Сочетание `x.y` (`size = l`, `gap = none`, `shape = default`), которого нет среди имён и идентификаторов значений. */
    private val combinationOnly =
        """{"componentName":"group","styleName":"combo","config":{"variations":[""" +
            """{"id":"size","name":"size","values":[{"name":"l"}]},""" +
            """{"id":"gap","name":"gap","values":[{"name":"none"}]},""" +
            """{"id":"shape","name":"shape","values":[{"name":"default","authoredId":"x.y",""" +
            """"targets":[{"properties":[{"id":"size","value":"l"},{"id":"gap","value":"none"}]}]}]}]}}"""

    /** Идентификатор `k` у значения `gap = none` и у сочетания `size = l`, `shape = default`. */
    private val clash =
        """{"componentName":"group","styleName":"clash","config":{"variations":[""" +
            """{"id":"size","name":"size","values":[{"name":"l"}]},""" +
            """{"id":"gap","name":"gap","values":[{"name":"none","authoredId":"k"}]},""" +
            """{"id":"shape","name":"shape","values":[{"name":"default","authoredId":"k",""" +
            """"targets":[{"properties":[{"id":"size","value":"l"}]}]}]}]}}"""

    /** Два сочетания с одним идентификатором `d`. */
    private val duplicated =
        """{"componentName":"group","styleName":"dup","config":{"variations":[""" +
            """{"id":"size","name":"size","values":[{"name":"l"}]},""" +
            """{"id":"gap","name":"gap","values":[{"name":"none"}]},""" +
            """{"id":"shape","name":"shape","values":[""" +
            """{"name":"a","authoredId":"d","targets":[{"properties":[{"id":"size","value":"l"}]}]},""" +
            """{"name":"b","authoredId":"d","targets":[{"properties":[{"id":"size","value":"l"},""" +
            """{"id":"gap","value":"none"}]}]}]}]}}"""

    private fun parent(styleName: String, reference: String) =
        """{"componentName":"parent","styleName":"$styleName","config":{"invariants":{"content":""" +
            """{"type":"component_style","value":"$reference"}}}}"""

    /** Глобальный слой `compose`: родитель со свойством `component_style` и цель ссылки. */
    private suspend fun seedGlobalLayer() {
        val components = listOf(
            """{"name":"Parent","states":["hovered"],"properties":[""" +
                """{"name":"content","type":"component_style","platformNames":["content"]}]}""",
            """{"name":"Group","states":["hovered"],"properties":[{"name":"gap","type":"value","platformNames":["gap"]}]}""",
        )
        val response = service.builder.client.post("/api/admin/component-config/import-api-meta") {
            actor(administrator = true)
            contentType(ContentType.Application.Json)
            setBody(
                """{"platform":"compose","meta":{"source":"references.json"},"dryRun":false,""" +
                    """"components":[${components.joinToString(",")}]}""",
            )
        }
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
    }

    private suspend fun designSystem(name: String = "references"): String {
        val created = service.builder.client.post("/api/design-systems") {
            actor(administrator = false)
            contentType(ContentType.Application.Json)
            setBody("""{"name":"$name","projectName":"$name"}""")
        }
        assertEquals(HttpStatusCode.Created, created.status, created.bodyAsText())
        return json.parseToJsonElement(created.bodyAsText()).jsonObject.getValue("id").jsonPrimitive.content
    }

    private suspend fun importPackage(system: String, entries: List<String>, dryRun: Boolean = false): JsonObject {
        val response = service.builder.client.post("/api/design-systems/$system/component-config/import") {
            actor(administrator = false)
            contentType(ContentType.Application.Json)
            setBody(
                """{"platform":"compose","meta":{"name":"references","source":"kotlin-test"},"dryRun":$dryRun,""" +
                    """"components":[${entries.joinToString(",")}]}""",
            )
        }
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return json.parseToJsonElement(response.bodyAsText()).jsonObject
    }

    private fun unresolved(report: JsonObject): List<String> =
        (report.getValue("unresolvedComponentStyles") as JsonArray).map { it.jsonPrimitive.content }

    /** Записанные ссылки: текст `reference` и число различных стилей, на которые она указывает. */
    private fun references(): Map<String, Int> =
        java.sql.DriverManager.getConnection(
            service.postgres.jdbcUrl,
            service.postgres.username,
            service.postgres.password,
        ).use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(
                    """
                    SELECT rr.reference, count(DISTINCT sr.style_id)
                    FROM component_style_reference_revisions rr
                    LEFT JOIN component_style_reference_styles st ON st.reference_id = rr.component_style_reference_id
                    LEFT JOIN component_style_reference_style_revisions sr
                        ON sr.component_style_reference_style_id = st.id
                    GROUP BY rr.reference
                    """.trimIndent(),
                ).use { rows ->
                    buildMap { while (rows.next()) put(rows.getString(1), rows.getInt(2)) }
                }
            }
        }

    // ── harness ────────────────────────────────────────────────────────────────────────────────────

    private class Service(val postgres: IsolatedPostgresDatabase, val builder: ApplicationTestBuilder)

    private lateinit var service: Service

    private fun withService(body: suspend ComponentStyleReferenceSegmentsIntegrationTest.() -> Unit) {
        IsolatedPostgresDatabase.create().use { postgres ->
            testApplication {
                application { module(configuration(postgres)) }
                service = Service(postgres, this)
                kotlinx.coroutines.runBlocking { body() }
            }
        }
    }

    private fun HttpRequestBuilder.actor(administrator: Boolean) {
        header("X-Actor-Type", "user")
        header("X-User-Id", if (administrator) "integration-admin" else "integration-user")
        header("X-Project-Id", if (administrator) "global" else "project-a")
        if (!administrator) header("X-Project-Role", "owner")
        header("X-System-Admin", administrator.toString())
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
}
