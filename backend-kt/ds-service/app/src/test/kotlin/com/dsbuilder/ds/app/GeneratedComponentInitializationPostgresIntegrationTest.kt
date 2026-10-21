package com.dsbuilder.ds.app

import com.dsbuilder.ds.components.data.GeneratedDesignSystemComponentInitializer
import com.dsbuilder.ds.tokens.data.GeneratedTokenDefinitionInitializer
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.jetbrains.exposed.v1.core.Transaction
import org.jetbrains.exposed.v1.core.statements.BatchInsertStatement
import org.jetbrains.exposed.v1.core.statements.StatementContext
import org.jetbrains.exposed.v1.core.statements.StatementInterceptor
import org.jetbrains.exposed.v1.core.statements.api.PreparedStatementApi
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertTrue

/** Полный каталог записывается пакетно, повтор не создаёт копий, поздний отказ откатывает все таблицы. */
class GeneratedComponentInitializationPostgresIntegrationTest {
    @Test
    fun `full component initialization batches rows and remains repeatable`() = withFixture { database, id ->
        val initializer = GeneratedDesignSystemComponentInitializer()
        var batches = 0
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
        assertEquals(expected.values.sumOf { (it + 249) / 250 } * 2, batches)
        assertCounts(database)
        transaction(database) { runBlocking { initializer.initialize(id) } }
        assertCounts(database)
    }

    @Test
    fun `late component revision failure rolls back all stable rows and revisions`() = withFixture { database, id ->
        transaction(database) {
            exec(
                """
                CREATE FUNCTION fail_component_batch() RETURNS trigger LANGUAGE plpgsql AS ${'$'}${'$'}
                BEGIN
                    IF (SELECT count(*) FROM variation_property_value_revisions) >= 300 THEN
                        RAISE EXCEPTION 'injected_component_failure';
                    END IF;
                    RETURN NEW;
                END; ${'$'}${'$'};
                CREATE TRIGGER fail_component_batch BEFORE INSERT ON variation_property_value_revisions
                FOR EACH ROW EXECUTE FUNCTION fail_component_batch();
                """.trimIndent(),
            )
        }
        val initializer = GeneratedDesignSystemComponentInitializer()
        val failure = assertFails {
            transaction(database) {
                maxAttempts = 1
                runBlocking { initializer.initialize(id) }
            }
        }
        assertTrue(failure.toString().contains("injected_component_failure"))
        assertCounts(database, empty = true)
        transaction(database) {
            exec("DROP TRIGGER fail_component_batch ON variation_property_value_revisions")
            exec("DROP FUNCTION fail_component_batch()")
            runBlocking { initializer.initialize(id) }
        }
        assertCounts(database)
    }

    private fun assertCounts(database: Database, empty: Boolean = false) = transaction(database) {
        expected.forEach { (stable, count) ->
            listOf(stable, revisions.getValue(stable)).forEach { table ->
                exec("SELECT count(*) FROM $table") {
                    check(it.next())
                    assertEquals(if (empty) 0 else count, it.getInt(1), table)
                }
            }
        }
    }

    private fun withFixture(block: (Database, UUID) -> Unit) {
        IsolatedPostgresDatabase.create().use { postgres ->
            ComponentSeedFixture.seed(postgres.jdbcUrl, postgres.username, postgres.password)
            val database = Database.connect(postgres.jdbcUrl, user = postgres.username, password = postgres.password)
            val id = UUID.randomUUID()
            transaction(database) {
                exec("INSERT INTO design_systems(id, project_name, project_id) VALUES ('$id', 'components', 'project')")
                exec(
                    "INSERT INTO design_system_versions(" +
                        "design_system_id, status, sequence_number, revision, published_at) " +
                        "VALUES ('$id', 'baseline', 0, 0, NULL)",
                )
                runBlocking { GeneratedTokenDefinitionInitializer().initialize(id) }
            }
            block(database, id)
        }
    }

    private val expected: Map<String, Int> by lazy {
        val components = requireNotNull(javaClass.getResourceAsStream("/component-seeds.json"))
            .bufferedReader().use { Json.parseToJsonElement(it.readText()).jsonObject.getValue("components").jsonArray }
            .map { it.jsonObject }
        val appearances = components.flatMap { it.items("appearances") }
        val variants = appearances.flatMap { appearance ->
            appearance["values"]?.jsonObject?.values.orEmpty().flatMap { axis ->
                axis.jsonObject.values.flatMap { it.jsonArray }.map { it.jsonObject }
            }
        }
        val invariants = appearances.flatMap { it.items("invariants") }
        val combinations = appearances.flatMap { it.items("combinations") }
        val axes = components.flatMap { component ->
            component.items("appearances").flatMap { appearance ->
                val declared = appearance["variations"]?.jsonArray?.toSet()
                component.items("variations").filter { declared == null || it["name"] in declared }
            }
        }
        mapOf(
            "design_system_components" to components.size,
            "styles" to components.sumOf { component ->
                component.items("variations").sumOf { it.items("styles").size }
            },
            "appearances" to appearances.size,
            "appearance_variations" to axes.size,
            "appearance_variation_values" to axes.sumOf { it.items("styles").size },
            "variation_property_values" to variants.size,
            "invariant_property_values" to invariants.size,
            "variation_platform_param_adjustments" to variants.sumOf { it.items("adjust").size },
            "invariant_platform_param_adjustments" to invariants.sumOf { it.items("adjust").size },
            "style_combinations" to combinations.size,
            "style_combination_members" to combinations.sumOf { it.getValue("styles").jsonObject.size },
        )
    }

    private fun JsonObject.items(name: String): List<JsonObject> = this[name]?.jsonArray.orEmpty().map { it.jsonObject }

    private val revisions = mapOf(
        "design_system_components" to "design_system_component_revisions",
        "styles" to "style_revisions",
        "appearances" to "appearance_revisions",
        "appearance_variations" to "appearance_variation_revisions",
        "appearance_variation_values" to "appearance_variation_value_revisions",
        "variation_property_values" to "variation_property_value_revisions",
        "invariant_property_values" to "invariant_property_value_revisions",
        "variation_platform_param_adjustments" to "variation_platform_param_adjustment_revisions",
        "invariant_platform_param_adjustments" to "invariant_platform_param_adjustment_revisions",
        "style_combinations" to "style_combination_revisions",
        "style_combination_members" to "style_combination_member_revisions",
    )
}
