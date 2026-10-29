package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.tokens.domain.Token
import org.jetbrains.exposed.v1.core.ResultRow

/** Maps Exposed token rows into domain entities. */
internal object TokenRowMapper {
    fun map(row: ResultRow) = Token(
        id = row[TokensTable.id],
        designSystemId = row[TokensTable.designSystemId],
        name = row[TokenRevisionsTable.name],
        type = row[TokenRevisionsTable.type],
        displayName = row[TokenRevisionsTable.displayName],
        description = row[TokenRevisionsTable.description],
        enabled = row[TokenRevisionsTable.enabled],
        createdAt = row[TokensTable.createdAt],
        updatedAt = row[TokenRevisionsTable.updatedAt],
    )
}
