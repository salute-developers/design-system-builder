package com.dsbuilder.ds.app

import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.readText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FlywayBaselineContractTest {
    @Test
    fun `baseline contains every applied drizzle migration without rewriting ddl`() {
        val repository = locateRepository()
        val migrationDirectory = repository.resolve("js/services/db-service/drizzle")
        val migrations = Files.list(migrationDirectory).use { stream ->
            stream.filter { it.fileName.toString().matches(Regex("000[0-9]_.*\\.sql")) }
                .sorted()
                .toList()
        }
        val expected = migrations.joinToString("\n\n") { migration ->
            "-- Source: ${migration.fileName}\n${migration.readText()}"
        }
        val actual = requireNotNull(javaClass.getResource("/db/migration/V1__db_service_baseline.sql"))
            .readText()

        assertEquals(expected, actual)
        assertTrue(actual.contains("CREATE OR REPLACE FUNCTION \"state_sets_canonicalize\""))
        assertTrue(actual.contains("CREATE TRIGGER"))
        assertTrue(actual.contains("CREATE TABLE \"design_systems\""))
        assertTrue(actual.contains("ADD COLUMN \"edit_revision\" integer DEFAULT 0 NOT NULL"))
        assertTrue(actual.contains("tenants_design_system_id_name_ci_unique"))
    }

    private fun locateRepository(): Path {
        var candidate = Path.of(System.getProperty("user.dir")).toAbsolutePath()
        repeat(6) {
            if (Files.exists(candidate.resolve("js/services/db-service/src/db/schema.ts"))) return candidate
            candidate = candidate.parent
        }
        error("Unable to locate repository root")
    }
}
