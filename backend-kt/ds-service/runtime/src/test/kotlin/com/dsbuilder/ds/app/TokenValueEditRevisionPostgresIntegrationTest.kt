package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.data.BatchJdbc
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Холодная статистика и чужие технические редакции не превращают чтение темы в декартов обход. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class TokenValueEditRevisionPostgresIntegrationTest {
    @Test
    fun `wide values preserve exact revisions with cold generic plans and unrelated states`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val db = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            val fixture = transaction(db = db) { seed() }
            val options = "-c%20plan_cache_mode%3Dforce_generic_plan%20-c%20statement_timeout%3D5000"
            val url = "${postgres.jdbcUrl}&prepareThreshold=1&options=$options"
            testApplication {
                application {
                    module(
                        DsServiceConfiguration(
                            0, url, postgres.username, postgres.password,
                            4, 5_000, null, false, false, null,
                        ),
                    )
                }
                val api = JournalHttpFixture(client, "project")
                val path = "/api/design-systems/${fixture.owner}/tenants/${fixture.tenant}/token-values"
                val response = api.request("GET", path)
                assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
                val values = Json.parseToJsonElement(response.bodyAsText()).jsonArray
                val revisions = values.associate {
                    UUID.fromString(it.jsonObject.getValue("id").jsonPrimitive.content) to
                        it.jsonObject.getValue("editRevision").jsonPrimitive.long
                }
                assertEquals(fixture.ids, revisions.keys)
                assertEquals(7L, revisions[fixture.changed])
                assertEquals(0L, revisions[fixture.missing])
                assertTrue(revisions.filterKeys { it != fixture.changed }.values.all { it == 0L })
                val token = values.first().jsonObject.getValue("tokenId").jsonPrimitive.content
                val addressed = api.get("$path?tokenIds=$token").jsonArray
                assertTrue(addressed.isNotEmpty())
                assertTrue(
                    addressed.all {
                        val id = UUID.fromString(it.jsonObject.getValue("id").jsonPrimitive.content)
                        revisions[id] == it.jsonObject.getValue("editRevision").jsonPrimitive.long
                    },
                )
                transaction(db = db) {
                    val rows = BatchJdbc().read(
                        "SELECT reltuples FROM pg_class WHERE relname IN ('token_values','entity_edit_states')",
                    ) { it.getDouble(1) }
                    assertEquals(2, rows.size)
                    assertTrue(rows.all { it < 1 }, "The regression must run without ANALYZE statistics")
                }
            }
        }
    }

    private fun seed(): ReadFixture {
        val jdbc = BatchJdbc()
        jdbc.query("ALTER TABLE token_values SET (autovacuum_enabled=false)")
        jdbc.query("ALTER TABLE entity_edit_states SET (autovacuum_enabled=false)")
        val fixture = JournalProjectionSqlFixture(6004)
        val changed = fixture.value("[1]", "[2]")
        val missing = fixture.value("[1]", "[1]")
        val foreign = fixture.value("[1]", "[2]", tenant = fixture.existingTenant)
        fixture.seedUnchanged(6001)
        jdbc.query(
            "DELETE FROM entity_edit_states WHERE design_system_id=? AND entity_type='token-value'",
            fixture.owner,
        )
        jdbc.query(
            """
            INSERT INTO entity_edit_states(design_system_version_id,design_system_id,entity_type,
                entity_id,revision,last_actor_id,updated_at)
            VALUES (?::uuid,?::uuid,'token-value',?::uuid,7,'fixture',now()),
                   (?::uuid,?::uuid,'token-value',?::uuid,23,'fixture',now()),
                   (?::uuid,?::uuid,'token',?::uuid,99,'fixture',now())
            """.trimIndent(),
            fixture.draft, fixture.owner, changed,
            fixture.draft, fixture.owner, foreign,
            fixture.draft, fixture.owner, changed,
        )
        jdbc.query(
            """
            INSERT INTO entity_edit_states(design_system_version_id,design_system_id,entity_type,
                entity_id,revision,last_actor_id,updated_at)
            SELECT ?::uuid,?::uuid,'token-value',md5('unrelated-'||i)::uuid,1,'fixture',now()
            FROM generate_series(1,100001) i
            """.trimIndent(),
            fixture.draft,
            fixture.owner,
        )
        val ids = jdbc.read("SELECT id FROM token_values WHERE tenant_id=?", fixture.newTenant) {
            it.getObject(1, UUID::class.java)
        }.toSet()
        assertEquals(6003, ids.size)
        return ReadFixture(fixture.owner, fixture.newTenant, changed, missing, ids)
    }

    private data class ReadFixture(
        val owner: UUID,
        val tenant: UUID,
        val changed: UUID,
        val missing: UUID,
        val ids: Set<UUID>,
    )
}
