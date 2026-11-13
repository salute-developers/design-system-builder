package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.application.JournalProjectionScope
import com.dsbuilder.ds.core.data.BatchJdbc
import com.dsbuilder.ds.themes.data.ThemeJournalCandidateProjection
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.io.File
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/** SQL-прототип проверяется до подключения к компактным HTTP-чтениям. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class JournalProjectionSqlPostgresIntegrationTest {
    @Test
    fun `projection excludes only unchanged creation values and preserves JSON distinctions`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val db = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            transaction(db = db) {
                val fixture = JournalProjectionSqlFixture()
                val same = fixture.value("[1]", "[1]")
                val numericScale = fixture.value("[1]", "[1.0]")
                val sqlNull = fixture.value(null, "null")
                val reverseNull = fixture.value("null", null)
                val objectOrder = fixture.value("""{"a":1,"b":2}""", """{"b":2,"a":1}""")
                val stringJson = fixture.value("[1]", """"[1]"""")
                val arrayOrder = fixture.value("[1,2]", "[2,1]")
                val override = fixture.value("[1]", "[1]", overridden = true)
                val missing = fixture.value("[1]", "[1]", baseline = false)
                val deleted = fixture.value("[1]", "[1]", deleted = true)
                val palette = fixture.palette()
                val otherPalette = fixture.palette()
                val samePalette = fixture.value(null, null, beforePalette = palette, afterPalette = palette)
                val differentPalette = fixture.value(null, null, beforePalette = palette, afterPalette = otherPalette)
                val oldTenant = fixture.value("[1]", "[1]", tenant = fixture.existingTenant)
                val ids = mutableListOf<UUID>()
                val projection = ThemeJournalCandidateProjection()
                projection.visit(fixture.scope) { ids.addAll(it) }
                assertEquals(
                    setOf(
                        numericScale,
                        stringJson,
                        arrayOrder,
                        override,
                        missing,
                        oldTenant,
                        differentPalette,
                    ),
                    ids.toSet(),
                )
                for (id in listOf(same, sqlNull, reverseNull, objectOrder, deleted, samePalette)) assertFalse(id in ids)
                val scoped = mutableListOf<UUID>()
                projection.visit(fixture.scope.copy(tenantId = fixture.existingTenant)) { scoped.addAll(it) }
                assertEquals(listOf(oldTenant), scoped)
                val foreign = mutableListOf<UUID>()
                projection.visit(fixture.scope.copy(designSystemId = UUID.randomUUID())) { foreign.addAll(it) }
                assertEquals(emptyList(), foreign)
                val sql = requireNotNull(javaClass.getResource("/dsbuilder/ds/seeds/journal-candidates.sql")).readText()
                val plan = BatchJdbc().read(
                    "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) $sql",
                    fixture.owner,
                    fixture.draft,
                    1L,
                    0L,
                    null,
                    null,
                ) { it.getString(1) }.single()
                File("/tmp/journal-prototype-plan.json").writeText(plan)
                val published = BatchJdbc().read(
                    "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) $sql",
                    fixture.owner,
                    fixture.draft,
                    1L,
                    0L,
                    fixture.existingTenant,
                    null,
                ) { it.getString(1) }.single()
                File("/tmp/journal-existing-tenant-plan.json").writeText(published)
            }
        }
    }

    @Test
    fun `candidate batches remain bounded for more than five hundred edits`() {
        IsolatedPostgresDatabase.create().use { postgres ->
            val db = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            transaction(db = db) {
                val fixture = JournalProjectionSqlFixture(501)
                val expected = List(501) { fixture.value("[1]", "[2]") }.toSet()
                val batches = mutableListOf<List<UUID>>()
                ThemeJournalCandidateProjection().visit(fixture.scope) { batches += it }
                assertEquals(listOf(500, 1), batches.map { it.size })
                assertEquals(expected, batches.flatten().toSet())
            }
        }
    }
}

/** Минимальная реальная схема: одна новая тема и одна существующая на предыдущей границе. */
internal class JournalProjectionSqlFixture(capacity: Int = 32, tokenType: String = "spacing") {
    val owner: UUID = UUID.randomUUID()
    private val base = UUID.randomUUID()
    val draft: UUID = UUID.randomUUID()
    val newTenant: UUID = UUID.randomUUID()
    val existingTenant: UUID = UUID.randomUUID()
    val scope = JournalProjectionScope(owner, draft, 1, 0, null)

    private lateinit var tokens: Iterator<UUID>

    init {
        exec(
            """
INSERT INTO design_systems(id, project_name, project_id) VALUES ('$owner', 'prototype',
'project')
            """.trimIndent(),
        )
        exec(
            """
INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision,
published_at) VALUES ('$base', '$owner', 'baseline', 0, 0, NULL)
            """.trimIndent(),
        )
        exec(
            """
INSERT INTO design_system_revisions(design_system_id, design_system_version_id,
version_sequence_number, name) VALUES ('$owner', '$base', 0, 'Prototype $owner')
            """.trimIndent(),
        )
        for ((tenant, boundary, sequence) in listOf(Triple(existingTenant, base, 0))) {
            exec("INSERT INTO tenants(id,design_system_id) VALUES ('$tenant','$owner')")
            exec(
                """
INSERT INTO tenant_revisions(tenant_id, design_system_id, design_system_version_id,
version_sequence_number, name) VALUES ('$tenant', '$owner', '$boundary', $sequence, 'Theme')
                """.trimIndent(),
            )
        }
        tokens = BatchJdbc().read(
            """
INSERT INTO tokens(id, design_system_id) SELECT gen_random_uuid(), ?::uuid FROM
generate_series(1, ?::integer) RETURNING id
            """.trimIndent(),
            owner, capacity,
        ) { it.getObject(1, UUID::class.java) }.iterator()
        exec(
            """
INSERT INTO token_revisions(token_id, design_system_id, design_system_version_id,
version_sequence_number, name, type) SELECT id, '$owner', '$base', 0, 'fixture.'||id::text,
'$tokenType' FROM tokens WHERE design_system_id='$owner'
            """.trimIndent(),
        )
        exec(
            """
INSERT INTO design_system_versions(id, design_system_id, status, sequence_number, revision,
published_at) VALUES ('$draft', '$owner', 'draft', 1, 0, NULL)
            """.trimIndent(),
        )
        exec("INSERT INTO tenants(id,design_system_id) VALUES ('$newTenant','$owner')")
        exec(
            """
INSERT INTO tenant_revisions(tenant_id, design_system_id, design_system_version_id,
version_sequence_number, name) VALUES ('$newTenant', '$owner', '$draft', 1, 'New theme')
            """.trimIndent(),
        )
    }

    fun value(
        before: String?,
        after: String?,
        overridden: Boolean = false,
        baseline: Boolean = true,
        deleted: Boolean = false,
        tenant: UUID = newTenant,
        beforePalette: UUID? = null,
        afterPalette: UUID? = null,
        platform: String = "web",
        mode: String = "light",
    ): UUID {
        val token = tokens.next()
        val id = UUID.randomUUID()
        exec(
            """
INSERT INTO token_values(id, design_system_id, token_id, tenant_id, platform, mode) VALUES
('$id', '$owner', '$token', '$tenant', '$platform', '$mode')
            """.trimIndent(),
        )
        if (baseline) {
            exec(
                """
INSERT INTO token_value_creation_baselines(design_system_version_id, token_value_id,
design_system_id, value, overridden, palette_id) VALUES ('$draft', '$id', '$owner',
${literal(before)}, false, ${uuidLiteral(beforePalette)})
                """.trimIndent(),
            )
        }
        exec(
            """
INSERT INTO token_value_revisions(token_value_id, design_system_id, design_system_version_id,
version_sequence_number, value, overridden, deleted, palette_id) VALUES ('$id', '$owner',
'$draft', 1, ${literal(after)}, $overridden, $deleted, ${uuidLiteral(afterPalette)})
            """.trimIndent(),
        )
        return id
    }

    fun seedUnchanged(count: Int) {
        val selected = BatchJdbc().uuids(List(count) { tokens.next() })
        BatchJdbc().query(
            """
INSERT INTO token_values(id, design_system_id, token_id, tenant_id, platform, mode) SELECT
gen_random_uuid(), ?::uuid, id, ?::uuid, 'web', 'light' FROM tokens WHERE id=ANY(?::uuid[])
            """.trimIndent(),
            owner,
            newTenant,
            selected,
        )
        exec(
            """
INSERT INTO token_value_creation_baselines(design_system_version_id, token_value_id,
design_system_id, value, overridden) SELECT '$draft', id, '$owner', '[1]'::jsonb, false FROM
token_values WHERE design_system_id='$owner' ON CONFLICT DO NOTHING
            """.trimIndent(),
        )
        exec(
            """
INSERT INTO token_value_revisions(token_value_id, design_system_id, design_system_version_id,
version_sequence_number, value, overridden) SELECT id, '$owner', '$draft', 1, '[1]'::jsonb,
false FROM token_values WHERE design_system_id='$owner' AND id NOT IN (SELECT token_value_id
FROM token_value_revisions WHERE design_system_id='$owner')
            """.trimIndent(),
        )
    }

    fun palette(): UUID {
        val id = UUID.randomUUID()
        exec(
            """
INSERT INTO palette(id, type, shade, saturation, value) VALUES ('$id', 'general', '$id', 1,
'#123456')
            """.trimIndent(),
        )
        return id
    }

    private fun uuidLiteral(value: UUID?): String = value?.let { "'$it'::uuid" } ?: "NULL"
    private fun literal(value: String?): String = value?.let { "'${it.replace("'", "''")}'::jsonb" } ?: "NULL"
    private fun exec(sql: String) { TransactionManager.current().exec(sql) }
}
