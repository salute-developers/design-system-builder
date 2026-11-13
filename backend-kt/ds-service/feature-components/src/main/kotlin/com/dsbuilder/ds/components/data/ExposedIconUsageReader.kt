package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.IconUsageReader
import org.jetbrains.exposed.v1.core.Column
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.alias
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.count
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNotNull
import org.jetbrains.exposed.v1.jdbc.select
import java.util.UUID

/**
 * Значения свойств типа `icon` из разрешённых ревизий `variation_property_values`, `invariant_property_values`
 * по всем дизайн-системам. Административная операция: область одной дизайн-системы не задаётся.
 */
internal class ExposedIconUsageReader : IconUsageReader {
    override suspend fun usedValues(): Map<String, Int> =
        listOf(
            VariationPropertyValuesTable.let { usage(it, it.value, it.propertyId) },
            InvariantPropertyValuesTable.let { usage(it, it.value, it.propertyId) },
            StyleCombinationsTable.let { usage(it, it.value, it.propertyId) },
        ).flatMap { it.entries }.groupingBy { it.key }.fold(0) { total, entry -> total + entry.value }

    private fun usage(table: Table, value: Column<out String?>, propertyId: Column<UUID>): Map<String, Int> {
        val references = value.count().alias("references")
        return table.join(PropertiesTable, JoinType.INNER, propertyId, PropertiesTable.id)
            .select(value, references)
            .where { (PropertiesTable.type eq PropertyTypeDb.ICON) and value.isNotNull() }
            .groupBy(value)
            .associate { requireNotNull(it[value]) to it[references].toInt() }
    }
}
