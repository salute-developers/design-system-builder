package com.dsbuilder.ds.app

import java.io.File
import java.sql.Connection
import java.util.UUID
import kotlin.system.measureNanoTime
import kotlin.test.assertEquals

/** Сравнивает полный JDBC-путь технических редакций на том же снимке, включая подготовку и преобразование. */
internal fun measureEditRevisionStrategies(connection: Connection, system: String, tenant: String) {
    val ids = connection.createStatement().use { statement ->
        statement.executeQuery("SELECT id FROM token_values WHERE tenant_id='$tenant' ORDER BY id").use { rows ->
            buildList { while (rows.next()) add(rows.getObject(1, UUID::class.java)) }
        }
    }
    val versions = connection.createStatement().use { statement ->
        statement.executeQuery("SELECT id FROM design_system_versions WHERE design_system_id='$system'").use { rows ->
            buildList { while (rows.next()) add(rows.getObject(1, UUID::class.java)) }
        }
    }
    val report = StringBuilder("version,count,strategy,medianMs\n")
    for (version in versions) for (count in listOf(1, 36, ids.size)) {
        val selected = ids.take(count)
        val strategies = listOf("in-all", "in-projection", "array") + if (count == ids.size) listOf("join") else emptyList()
        val times = strategies.associateWith { mutableListOf<Double>() }
        repeat(23) { iteration ->
            val order = if (iteration % 2 == 0) times.keys.toList() else times.keys.reversed()
            var expected: Map<UUID, Long>? = null
            for (strategy in order) {
                val values = mutableMapOf<UUID, Long>()
                val elapsed = measureNanoTime {
                    val array = if (strategy == "array") connection.createArrayOf("uuid", selected.toTypedArray()) else null
                    try {
                        val projection = if (strategy == "in-all") "*" else "entity_id,revision"
                        val predicate = when {
                            strategy == "join" -> ""
                            array != null -> "= ANY(?)"
                            else -> "IN (${selected.joinToString(",") { "?" }})"
                        }
                        connection.prepareStatement(
                            if (strategy == "join") {
                                "SELECT e.entity_id,e.revision FROM entity_edit_states e JOIN token_values v ON v.id=e.entity_id " +
                                    "WHERE e.design_system_version_id=? AND e.entity_type=? AND v.tenant_id=?"
                            } else {
                                "SELECT $projection FROM entity_edit_states WHERE design_system_version_id=? " +
                                    "AND entity_type=? AND entity_id $predicate"
                            },
                        ).use { statement ->
                            statement.setObject(1, version)
                            statement.setString(2, "token-value")
                            if (strategy == "join") statement.setObject(3, UUID.fromString(tenant))
                            else if (array != null) statement.setArray(3, array)
                            else selected.forEachIndexed { index, id -> statement.setObject(index + 3, id) }
                            statement.executeQuery().use { rows ->
                                while (rows.next()) values[rows.getObject("entity_id", UUID::class.java)] = rows.getLong("revision")
                            }
                        }
                    } finally {
                        array?.free()
                    }
                } / 1_000_000.0
                expected?.let { assertEquals(it, values) }
                expected = values
                if (iteration >= 3) times.getValue(strategy) += elapsed
            }
        }
        times.forEach { (strategy, samples) ->
            val sorted = samples.sorted()
            report.appendLine("$version,$count,$strategy,${(sorted[9] + sorted[10]) / 2}")
        }
    }
    File(System.getProperty("ds.performance.output")).writeText(report.toString())
}
