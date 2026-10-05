package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.tokens.domain.TokenValue
import org.jetbrains.exposed.v1.core.ResultRow

/** Maps Exposed token-value rows into domain entities. */
internal object TokenValueRowMapper {
    fun map(row: ResultRow) = TokenValue(
        id = row[TokenValuesTable.id],
        tokenId = row[TokenValuesTable.tokenId],
        tenantId = row[TokenValuesTable.tenantId],
        paletteId = row[TokenValuesTable.paletteId],
        platform = row[TokenValuesTable.platform],
        mode = row[TokenValuesTable.mode],
        value = row[TokenValuesTable.value],
        createdAt = row[TokenValuesTable.createdAt],
        updatedAt = row[TokenValuesTable.updatedAt],
    )
}
