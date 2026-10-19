package com.dsbuilder.ds.app

import com.dsbuilder.ds.tokens.data.GeneratedTokenDefinitionInitializer
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.core.statements.BatchInsertStatement
import org.jetbrains.exposed.v1.core.statements.StatementContext
import org.jetbrains.exposed.v1.core.statements.StatementInterceptor
import org.jetbrains.exposed.v1.core.statements.api.PreparedStatementApi
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.sql.DriverManager
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertTrue

/** Пакеты сохраняют канонические определения и полностью откатываются при ошибке позднего пакета. */
class GeneratedTokenInitializationPostgresIntegrationTest {
    @Test
    fun `initialization batches statements preserves defaults and is repeatable`() = withBaseline { database, id ->
        var batches = 0
        val initializer = GeneratedTokenDefinitionInitializer()
        transaction(database) {
            registerInterceptor(object : StatementInterceptor {
                override fun afterExecution(
                    transaction: Transaction,
                    contexts: List<StatementContext>,
                    executedStatement: PreparedStatementApi,
                ) {
                    if (contexts.any { it.statement is BatchInsertStatement }) batches++
                }
            })
            runBlocking { initializer.initialize(id) }
        }
        assertEquals(((definitions.size + 249) / 250) * 2, batches)
        transaction(database) {
            exec(
                "SELECT name, type::text, display_name, description, enabled, deleted, updated_at FROM token_revisions",
            ) {
                val actual = linkedMapOf<String, List<String?>>()
                while (it.next()) {
                    assertEquals(false, it.getBoolean("deleted"))
                    assertTrue(it.getTimestamp("updated_at") != null)
                    actual[it.getString("name")] = listOf("type", "display_name", "description")
                        .map(it::getString) + it.getBoolean("enabled").toString()
                }
                assertEquals(definitions, actual)
            }
            exec("SELECT count(*), count(created_at) FROM tokens") {
                it.next()
                assertEquals(definitions.size, it.getInt(1))
                assertEquals(definitions.size, it.getInt(2))
            }
            runBlocking { initializer.initialize(id) }
            exec(
                "SELECT count(*), count(DISTINCT token_id), bool_and(version_sequence_number = 0) FROM token_revisions",
            ) {
                it.next()
                assertEquals(definitions.size, it.getInt(1))
                assertEquals(definitions.size, it.getInt(2))
                assertEquals(true, it.getBoolean(3))
            }
        }
    }

    @Test
    fun `failure after the first batch rolls back stable tokens and all revisions`() = withBaseline { database, id ->
        transaction(database) {
            exec(
                """
                CREATE FUNCTION fail_late_token_batch() RETURNS trigger LANGUAGE plpgsql AS ${'$'}${'$'}
                BEGIN
                    IF (SELECT count(*) FROM token_revisions) >= 300 THEN
                        RAISE EXCEPTION 'injected_initializer_failure';
                    END IF;
                    RETURN NEW;
                END; ${'$'}${'$'};
                CREATE TRIGGER fail_late_token_batch BEFORE INSERT ON token_revisions
                FOR EACH ROW EXECUTE FUNCTION fail_late_token_batch();
                """.trimIndent(),
            )
        }
        val failure = assertFails {
            transaction(database) {
                maxAttempts = 1
                runBlocking { GeneratedTokenDefinitionInitializer().initialize(id) }
            }
        }
        assertTrue(failure.toString().contains("injected_initializer_failure"))
        transaction(database) {
            listOf("tokens", "token_revisions").forEach { table ->
                exec("SELECT count(*) FROM $table") {
                    it.next()
                    assertEquals(0, it.getInt(1))
                }
            }
            exec("DROP TRIGGER fail_late_token_batch ON token_revisions")
            exec("DROP FUNCTION fail_late_token_batch()")
            runBlocking { GeneratedTokenDefinitionInitializer().initialize(id) }
            exec("SELECT count(*) FROM token_revisions") {
                it.next()
                assertEquals(definitions.size, it.getInt(1))
            }
        }
    }

    private val definitions: Map<String, List<String?>> by lazy {
        val text = requireNotNull(javaClass.classLoader.getResourceAsStream("token-definitions.json"))
            .bufferedReader().use { it.readText() }
        Json.parseToJsonElement(text).jsonArray.map { it.jsonObject }.distinctBy { it.getValue("name") }
            .associate { definition ->
                definition.getValue("name").jsonPrimitive.content to
                    listOf("type", "displayName", "description", "enabled")
                        .map { definition.getValue(it).jsonPrimitive.content }
            }
    }

    private fun withBaseline(block: (Database, UUID) -> Unit) {
        IsolatedPostgresDatabase.create().use { postgres ->
            val id = UUID.randomUUID()
            val boundary = UUID.randomUUID()
            DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
                connection.createStatement().use {
                    it.execute(
                        "INSERT INTO design_systems(id, project_name, project_id) VALUES ('$id', 'batch', 'project')",
                    )
                    it.execute(
                        "INSERT INTO design_system_versions(" +
                            "id, design_system_id, status, sequence_number, revision, published_at) " +
                            "VALUES ('$boundary', '$id', 'baseline', 0, 0, NULL)",
                    )
                }
            }
            block(Database.connect(postgres.jdbcUrl, "org.postgresql.Driver", postgres.username, postgres.password), id)
        }
    }
}
