package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.tokens.domain.Token
import org.jetbrains.exposed.v1.core.ResultRow

/** Maps Exposed token rows into domain entities. */
internal object TokenRowMapper {
    fun map(row: ResultRow) = Token(
        id = row[TokensTable.id],
        designSystemId = row[TokensTable.designSystemId],
        name = row[TokensTable.name],
        type = row[TokensTable.type],
        displayName = row[TokensTable.displayName],
        description = row[TokensTable.description],
        enabled = row[TokensTable.enabled],
        createdAt = row[TokensTable.createdAt],
        updatedAt = row[TokensTable.updatedAt],
    )
}
