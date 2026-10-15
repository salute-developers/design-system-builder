package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.QueryBuilder

/** Ограничивает выборку последней предметной редакцией на выбранной временной границе. */
fun latestRevision(
    revisionTable: String,
    entityColumn: String,
    sequenceColumn: String = "version_sequence_number",
    boundaryTable: String = "design_system_versions",
): Op<Boolean> = object : Op<Boolean>() {
    override fun toQueryBuilder(queryBuilder: QueryBuilder) {
        require(SQL_IDENTIFIER.matches(revisionTable))
        require(SQL_IDENTIFIER.matches(entityColumn))
        require(SQL_IDENTIFIER.matches(sequenceColumn))
        require(SQL_IDENTIFIER.matches(boundaryTable))
        queryBuilder.append("$revisionTable.$sequenceColumn = (")
        queryBuilder.append("SELECT max(candidate.$sequenceColumn) FROM $revisionTable candidate ")
        queryBuilder.append("WHERE candidate.$entityColumn = $revisionTable.$entityColumn ")
        queryBuilder.append("AND candidate.$sequenceColumn <= $boundaryTable.sequence_number)")
    }
}

private val SQL_IDENTIFIER = Regex("[a-z][a-z0-9_]*")
