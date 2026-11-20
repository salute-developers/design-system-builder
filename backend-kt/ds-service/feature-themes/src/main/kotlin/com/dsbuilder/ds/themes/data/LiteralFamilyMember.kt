package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.ThemeTokenType
import java.sql.ResultSet
import java.util.UUID

/** Определение члена семейства для планирования блокировок. */
internal data class LiteralFamilyMember(val id: UUID, val type: ThemeTokenType, val name: String)

internal fun literalFamilyMember(row: ResultSet): LiteralFamilyMember = LiteralFamilyMember(
    id = row.getObject("id", UUID::class.java),
    type = requireNotNull(ThemeTokenType.fromWire(row.getString("type"))),
    name = row.getString("name"),
)
