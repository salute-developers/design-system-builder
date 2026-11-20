package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import java.sql.ResultSet

/** Значение после предполагаемого удаления выбранных редакций; отсутствие видимой темы исключает его из семейства. */
internal data class RestoredFamilyValue(
    val member: LiteralFamilyMember,
    val platform: ThemeTokenPlatform?,
    val value: String?,
    val tenantDeleted: Boolean?,
)

internal fun restoredFamilyValue(row: ResultSet): RestoredFamilyValue = RestoredFamilyValue(
    member = literalFamilyMember(row),
    platform = ThemeTokenPlatform.entries.firstOrNull { it.wireValue == row.getString("platform") },
    value = row.getString("value"),
    tenantDeleted = row.getObject("tenant_deleted", Boolean::class.javaObjectType),
)
