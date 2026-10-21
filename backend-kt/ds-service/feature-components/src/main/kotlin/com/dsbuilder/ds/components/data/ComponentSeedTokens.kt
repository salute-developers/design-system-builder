package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Читает определения исходной границы до появления черновика, не подменяя исторический контекст. */
internal fun componentSeedTokens(owner: UUID): Map<String, UUID> = TransactionManager.current().exec(
    """
    SELECT revision.name, token.id FROM tokens token
    JOIN token_revisions revision ON revision.token_id = token.id
    JOIN design_system_versions boundary ON boundary.id = revision.design_system_version_id
    WHERE token.design_system_id = ? AND boundary.design_system_id = token.design_system_id
      AND boundary.status = 'baseline' AND NOT revision.deleted
    """.trimIndent(),
    listOf(UUIDColumnType() to owner),
) { rows ->
    buildMap {
        while (rows.next()) put(rows.getString("name"), rows.getObject("id", UUID::class.java))
    }
} ?: emptyMap()
