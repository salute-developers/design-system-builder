package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.data.ExposedDraftChangeRepository
import com.dsbuilder.ds.designsystems.data.designSystemDraftChangeHandler
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.themes.data.themeDraftChangeHandlers
import com.dsbuilder.ds.themes.data.themeDraftChangePolicy
import com.dsbuilder.ds.tokens.data.tokenDraftChangeHandlers
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.testcontainers.containers.PostgreSQLContainer
import java.sql.Connection
import java.sql.DriverManager
import java.sql.SQLException
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * V13 на данных сида: градиентные семейства сида в прежнем виде (12 заглушек и 5 настоящих градиентов) в исходной,
 * опубликованной и черновой границах приводятся к правилу вида значений без черновых редакций и записей журнала.
 */
class ColorTokenValueKindMigrationPostgresIntegrationTest {
    private val definitions = resource("/token-definitions.json").jsonArray.map { it.jsonObject }
        .filter { "gradient" in it.text("name") }.distinctBy { it.text("name") }
    private val expected = resource("/token-initial-values.json").jsonObject.getValue("values").jsonArray
        .map { it.jsonObject }.filter { "gradient" in it.text("name") }
        .associate { Key(it.text("name"), it.text("platform"), it.text("mode")) to it.getValue("value") }

    @Test
    fun `seed gradient families follow the value kind rule on every boundary`() {
        PostgreSQLContainer<Nothing>("postgres:16-alpine").use { postgres ->
            postgres.start()
            assertEquals(12, flyway(postgres, "12").migrate().migrationsExecuted)
            val fixture = connection(postgres).use(::seedLegacyGradients)
            val rowsBefore = connection(postgres).use(::rowsPerBoundary)

            assertEquals(1, flyway(postgres).migrate().migrationsExecuted)

            connection(postgres).use { connection ->
                assertEquals(rowsBefore, rowsPerBoundary(connection), "V13 не создаёт и не удаляет редакции")
                val types = query(connection, "SELECT name, type::text FROM token_revisions") { it.getString(2) }
                val expectedTypes = definitions.associate { it.text("name") to it.text("type") }
                types.forEach { (name, type) -> assertEquals(expectedTypes.getValue(name), type, name) }
                val families = types.entries.groupBy({ family(it.key) }, { it.value }).mapValues { it.value.toSet() }
                assertEquals(12, families.count { it.value == setOf("color") })
                assertEquals(REAL_FAMILIES, families.filterValues { it == setOf("gradient") }.keys)

                // Исходная граница двух тем и черновая новая тема совпадают с сидом новой дизайн-системы.
                listOf(fixture.tenantA, fixture.tenantB).forEach { tenant ->
                    assertEquals(expected, values(connection, tenant, fixture.baselineId, "token_value_revisions"))
                }
                assertEquals(expected, values(connection, fixture.tenantC, fixture.draftId, "token_value_revisions"))
                assertEquals(
                    expected,
                    values(connection, fixture.tenantC, fixture.draftId, "token_value_creation_baselines"),
                )

                // Опубликованная граница: нативные значения повторяют web той же границы.
                val published = values(connection, fixture.tenantA, fixture.publishedId, "token_value_revisions")
                listOf("ios", "android").forEach { platform ->
                    assertEquals(hex("#123456"), published.getValue(Key(STUB_EDIT, platform, "light")))
                    assertEquals(hex("#ABCDEF"), published.getValue(Key(REAL_EDIT, platform, "light")))
                }
                // Черновая нативная правка заглушки до миграции совпадает с web и в журнале не видна.
                val draftEdits = values(connection, fixture.tenantA, fixture.draftId, "token_value_revisions")
                assertEquals(mapOf(Key(STUB_EDIT, "ios", "light") to hex("#123456")), draftEdits)

                assertEquals("0", scalar(connection, "SELECT count(*) FROM token_value_revisions WHERE overridden"))
                assertEquals(
                    "0",
                    scalar(connection, "SELECT count(*) FROM token_value_creation_baselines WHERE overridden"),
                )
                assertEquals(
                    "144",
                    scalar(
                        connection,
                        "SELECT count(*) FROM v13_color_token_backup WHERE source_table = 'token_revisions'",
                    ),
                )
                assertTrue(
                    scalar(
                        connection,
                        "SELECT count(*) FROM v13_color_token_backup WHERE source_table = 'token_value_revisions' " +
                            "AND previous_value::text LIKE '%linear%'",
                    ).toInt() > 0,
                )
                val immutable = assertFailsWith<SQLException> {
                    execute(connection, "UPDATE token_value_revisions SET value = NULL")
                }
                assertEquals("40001", immutable.sqlState, "защитный триггер снова включён")
            }
            assertJournalOnlyShowsCreatedTheme(postgres, fixture)
        }
    }

    private fun assertJournalOnlyShowsCreatedTheme(postgres: PostgreSQLContainer<Nothing>, fixture: Fixture) {
        val database = Database.connect(
            url = postgres.jdbcUrl,
            driver = "org.postgresql.Driver",
            user = postgres.username,
            password = postgres.password,
        )
        val journal = ExposedDraftChangeRepository(
            listOf(designSystemDraftChangeHandler()) + themeDraftChangeHandlers() + tokenDraftChangeHandlers(),
            listOf(themeDraftChangePolicy()),
        )
        val changes = transaction(database) {
            runBlocking { journal.list(ProjectId(PROJECT), false, DesignSystemId(fixture.designSystemId), null) }
        }.orEmpty()
        assertEquals(listOf("tenant" to fixture.tenantC), changes.map { it.entityType to it.entityId })
    }

    @Suppress("LongMethod")
    private fun seedLegacyGradients(connection: Connection): Fixture {
        val fixture = Fixture()
        execute(
            connection,
            "INSERT INTO design_systems(id, project_name, project_id) " +
                "VALUES ('${fixture.designSystemId}', 'f', '$PROJECT')",
            boundary(fixture, fixture.baselineId, "baseline", 0),
            "INSERT INTO design_system_revisions(design_system_id, design_system_version_id, " +
                "version_sequence_number, name, deleted) " +
                "VALUES ('${fixture.designSystemId}', '${fixture.baselineId}', 0, 'Fixture', false)",
        )
        listOf(fixture.tenantA, fixture.tenantB).forEach { tenant -> insertTenant(connection, fixture, tenant, 0) }
        val tokens = definitions.associate { it.text("name") to UUID.randomUUID() }
        connection.prepareStatement("INSERT INTO tokens(id, design_system_id) VALUES (?, ?)").use { statement ->
            tokens.values.forEach { id ->
                statement.setObject(1, id)
                statement.setObject(2, fixture.designSystemId)
                statement.addBatch()
            }
            statement.executeBatch()
        }
        connection.prepareStatement(
            "INSERT INTO token_revisions(token_id, design_system_id, design_system_version_id, " +
                "version_sequence_number, name, type, display_name, description, enabled, deleted) " +
                "VALUES (?, ?, ?, 0, ?, 'gradient', ?, ?, ?, false)",
        ).use { statement ->
            definitions.forEach { definition ->
                statement.setObject(1, tokens.getValue(definition.text("name")))
                statement.setObject(2, fixture.designSystemId)
                statement.setObject(3, fixture.baselineId)
                statement.setString(4, definition.text("name"))
                statement.setString(5, definition.text("displayName"))
                statement.setString(6, definition.text("description"))
                statement.setBoolean(7, definition.text("enabled").toBoolean())
                statement.addBatch()
            }
            statement.executeBatch()
        }
        val legacy = expected.mapValues { (key, value) -> legacyValue(key, value) }
        val valueIds = listOf(fixture.tenantA, fixture.tenantB).associateWith { tenant ->
            insertValues(connection, fixture, tokens, tenant, fixture.baselineId, 0, legacy)
        }
        // Опубликованная правка старого клиента: все платформы одной пары, у натива — другая заглушка. Совпавшая с
        // предыдущей границей строка сжимается триггером и V13 не создаёт её заново: строки правятся только на месте.
        execute(connection, boundary(fixture, fixture.publishedId, "draft", 1))
        val edits = mapOf(STUB_EDIT to "#123456", REAL_EDIT to "#ABCDEF")
        edits.forEach { (name, color) ->
            PLATFORMS.forEach { platform ->
                val value = if (platform == "web") hex(color) else STUB_EDITED
                insertRevision(
                    connection,
                    fixture,
                    valueIds.getValue(fixture.tenantA).getValue(Key(name, platform, "light")),
                    fixture.publishedId,
                    1,
                    value,
                )
            }
        }
        execute(
            connection,
            "UPDATE design_system_versions SET status = 'published', version = '1.0.0', published_at = now() " +
                "WHERE id = '${fixture.publishedId}'",
            boundary(fixture, fixture.draftId, "draft", 2),
        )
        // Черновая правка старого клиента до миграции: только нативный слой заглушки в существующей теме.
        insertRevision(
            connection,
            fixture,
            valueIds.getValue(fixture.tenantA).getValue(Key(STUB_EDIT, "ios", "light")),
            fixture.draftId,
            2,
            STUB,
        )
        // Тема, созданная в черновике: редакции и основа создания в прежнем виде.
        insertTenant(connection, fixture, fixture.tenantC, 2)
        val created = insertValues(connection, fixture, tokens, fixture.tenantC, fixture.draftId, 2, legacy)
        connection.prepareStatement(
            "INSERT INTO token_value_creation_baselines(design_system_version_id, token_value_id, design_system_id, " +
                "value) VALUES (?, ?, ?, CAST(? AS jsonb))",
        ).use { statement ->
            created.forEach { (key, id) ->
                statement.setObject(1, fixture.draftId)
                statement.setObject(2, id)
                statement.setObject(3, fixture.designSystemId)
                statement.setString(4, legacy.getValue(key).toString())
                statement.addBatch()
            }
            statement.executeBatch()
        }
        return fixture
    }

    /** Прежний сид: у членов со сплошным web на iOS и Android — заглушка «белый → чёрный». */
    private fun legacyValue(key: Key, value: JsonElement): JsonElement {
        val web = expected.getValue(Key(key.name, "web", key.mode))
        val solid = (web as? JsonArray)?.singleOrNull()?.jsonPrimitive?.content?.startsWith("#") == true
        return if (key.platform != "web" && solid) STUB else value
    }

    private fun insertTenant(connection: Connection, fixture: Fixture, tenant: UUID, sequence: Long) {
        val boundaryId = if (sequence == 0L) fixture.baselineId else fixture.draftId
        execute(
            connection,
            "INSERT INTO tenants(id, design_system_id) VALUES ('$tenant', '${fixture.designSystemId}')",
            "INSERT INTO tenant_revisions(tenant_id, design_system_id, design_system_version_id, " +
                "version_sequence_number, name, deleted) VALUES ('$tenant', '${fixture.designSystemId}', " +
                "'$boundaryId', $sequence, 'theme-$tenant', false)",
        )
    }

    @Suppress("LongParameterList")
    private fun insertValues(
        connection: Connection,
        fixture: Fixture,
        tokens: Map<String, UUID>,
        tenant: UUID,
        boundaryId: UUID,
        sequence: Long,
        values: Map<Key, JsonElement>,
    ): Map<Key, UUID> {
        val ids = values.keys.associateWith { UUID.randomUUID() }
        connection.prepareStatement(
            "INSERT INTO token_values(id, design_system_id, token_id, tenant_id, platform, mode) " +
                "VALUES (?, ?, ?, ?, CAST(? AS platform), CAST(? AS mode))",
        ).use { statement ->
            ids.forEach { (key, id) ->
                statement.setObject(1, id)
                statement.setObject(2, fixture.designSystemId)
                statement.setObject(3, tokens.getValue(key.name))
                statement.setObject(4, tenant)
                statement.setString(5, key.platform)
                statement.setString(6, key.mode)
                statement.addBatch()
            }
            statement.executeBatch()
        }
        ids.forEach { (key, id) -> insertRevision(connection, fixture, id, boundaryId, sequence, values.getValue(key)) }
        return ids
    }

    @Suppress("LongParameterList")
    private fun insertRevision(
        connection: Connection,
        fixture: Fixture,
        valueId: UUID,
        boundaryId: UUID,
        sequence: Long,
        value: JsonElement,
    ) {
        connection.prepareStatement(
            "INSERT INTO token_value_revisions(token_value_id, design_system_id, design_system_version_id, " +
                "version_sequence_number, value, deleted) VALUES (?, ?, ?, ?, CAST(? AS jsonb), false)",
        ).use { statement ->
            statement.setObject(1, valueId)
            statement.setObject(2, fixture.designSystemId)
            statement.setObject(3, boundaryId)
            statement.setLong(4, sequence)
            statement.setString(5, value.toString())
            statement.executeUpdate()
        }
    }

    private fun values(connection: Connection, tenant: UUID, boundaryId: UUID, table: String): Map<Key, JsonElement> {
        val sql = """
            SELECT revision.name, value.platform::text, value.mode::text, row.value::text
            FROM $table row
            JOIN token_values value ON value.id = row.token_value_id
            JOIN token_revisions revision ON revision.token_id = value.token_id
            WHERE value.tenant_id = '$tenant' AND row.design_system_version_id = '$boundaryId'
        """.trimIndent()
        return connection.createStatement().use { statement ->
            statement.executeQuery(sql).use { rows ->
                buildMap {
                    while (rows.next()) {
                        put(
                            Key(rows.getString(1), rows.getString(2), rows.getString(3)),
                            Json.parseToJsonElement(rows.getString(4)),
                        )
                    }
                }
            }
        }
    }

    private fun rowsPerBoundary(connection: Connection): Map<String, String> = query(
        connection,
        "SELECT 'values:' || design_system_version_id, count(*)::text FROM token_value_revisions GROUP BY 1 " +
            "UNION ALL SELECT 'tokens:' || design_system_version_id, count(*)::text FROM token_revisions GROUP BY 1 " +
            "UNION ALL SELECT 'edits', count(*)::text FROM entity_edit_states",
    ) { it.getString(2) }

    private fun <T> query(connection: Connection, sql: String, value: (java.sql.ResultSet) -> T): Map<String, T> =
        connection.createStatement().use { statement ->
            statement.executeQuery(sql).use { rows ->
                buildMap { while (rows.next()) put(rows.getString(1), value(rows)) }
            }
        }

    private fun boundary(fixture: Fixture, id: UUID, status: String, sequence: Long) =
        "INSERT INTO design_system_versions(id, design_system_id, version, snapshot, publication_status, " +
            "published_at, status, sequence_number, revision, created_at) " +
            "VALUES ('$id', '${fixture.designSystemId}', NULL, NULL, NULL, NULL, '$status', $sequence, 0, now())"

    private fun execute(connection: Connection, vararg sql: String) {
        connection.createStatement().use { statement -> sql.forEach(statement::execute) }
    }

    private fun scalar(connection: Connection, sql: String): String = connection.createStatement().use { statement ->
        statement.executeQuery(sql).use { rows ->
            check(rows.next())
            rows.getString(1)
        }
    }

    private fun family(name: String): String {
        val (group, _, member) = name.split('.')
        return "$group/" + member.replace(Regex("-(hover|active|brightness)$"), "")
    }

    private fun hex(color: String): JsonElement = JsonArray(listOf(JsonPrimitive(color)))

    private fun flyway(postgres: PostgreSQLContainer<Nothing>, target: String = "latest") = Flyway.configure()
        .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        .locations("classpath:db/migration").target(target).load()

    private fun connection(postgres: PostgreSQLContainer<Nothing>): Connection =
        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password)

    private fun resource(path: String): JsonElement = requireNotNull(javaClass.getResourceAsStream(path))
        .bufferedReader().use { Json.parseToJsonElement(it.readText()) }

    private fun kotlinx.serialization.json.JsonObject.text(name: String): String =
        getValue(name).jsonPrimitive.content

    private data class Key(val name: String, val platform: String, val mode: String)

    private data class Fixture(
        val designSystemId: UUID = UUID.randomUUID(),
        val baselineId: UUID = UUID.randomUUID(),
        val publishedId: UUID = UUID.randomUUID(),
        val draftId: UUID = UUID.randomUUID(),
        val tenantA: UUID = UUID.randomUUID(),
        val tenantB: UUID = UUID.randomUUID(),
        val tenantC: UUID = UUID.randomUUID(),
    )

    private companion object {
        const val PROJECT = "project"
        const val STUB_EDIT = "text.default.promo-gradient"
        const val REAL_EDIT = "surface.default.accent-gradient-hover"
        val PLATFORMS = listOf("web", "ios", "android")
        val REAL_FAMILIES = setOf(
            "text/accent-gradient",
            "surface/accent-gradient",
            "outline/accent-gradient",
            "surface/skeleton-gradient",
            "surface/skeleton-deep-gradient",
        )
        val STUB: JsonElement = Json.parseToJsonElement(
            """[{"kind":"linear","locations":[0,1],"colors":["#FFFFFF","#000000"],"angle":90}]""",
        )
        val STUB_EDITED: JsonElement = Json.parseToJsonElement(
            """[{"kind":"linear","locations":[0,1],"colors":["#000000","#FFFFFF"],"angle":90}]""",
        )
    }
}
