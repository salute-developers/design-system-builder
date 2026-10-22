package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Читает редакцию состояния; вызывается только чтением курсора или защищённой публикацией, не обычной записью. */
fun resolvedDraftRevision(boundaryId: UUID): Long = TransactionManager.current().exec(
    "SELECT resolved_draft_revision(?)",
    listOf(UUIDColumnType() to boundaryId),
) { rows ->
    check(rows.next())
    rows.getLong(1).also { require(it in 0..9_007_199_254_740_991L) { "Draft revision exceeds exact wire range" } }
} ?: error("Draft boundary is missing")
