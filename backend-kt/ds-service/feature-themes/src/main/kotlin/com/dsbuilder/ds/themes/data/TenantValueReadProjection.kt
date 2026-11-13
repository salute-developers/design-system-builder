package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.BatchJdbc
import com.dsbuilder.ds.core.data.ResolvedSubjectRows
import com.dsbuilder.ds.core.data.entityEditRevisions
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import java.util.UUID

/**
 * Узкий GET после проверки темы: та же граница и LATERAL, одна материализация с заранее прочитанными номерами
 * редакций.
 */
internal fun readTenantValueProjection(
    owner: UUID,
    tenant: UUID,
    definitions: List<ResultRow>,
    tokenIds: Set<UUID>?,
    versionId: UUID,
): List<TenantTokenValue> {
    val tokens = definitions.associate { row ->
        row[ThemeTokensTable.id] to (row[ThemeTokenRevisionsTable.name] to row[ThemeTokenRevisionsTable.type])
    }
    // Адресный контракт ограничен 200 определениями. Для такого среза читаем редакции по точным ID
    // уже найденных значений; широкий JOIN проигрывал на 498 значениях типографики при заполненных редакциях.
    val exactRevisions = tokens.size <= 200
    val edits = if (exactRevisions) emptyMap() else selectedValueEditRevisions(versionId, owner, tenant, tokenIds)
    val reader = ResolvedSubjectRows(
        ThemeTokenValuesTable,
        ThemeTokenValueRevisionsTable,
        ThemeVersionBoundariesTable,
        ThemeTokenValueRevisionsTable.tokenValueId,
        designSystemId = owner,
        columns = listOf(
            ThemeTokenValuesTable.id, ThemeTokenValuesTable.tokenId, ThemeTokenValuesTable.tenantId,
            ThemeTokenValuesTable.platform, ThemeTokenValuesTable.mode, ThemeTokenValuesTable.createdAt,
            ThemeTokenValueRevisionsTable.paletteId, ThemeTokenValueRevisionsTable.value,
            ThemeTokenValueRevisionsTable.overridden, ThemeTokenValueRevisionsTable.updatedAt,
        ),
    )
    var predicate = (ThemeTokenValuesTable.designSystemId eq owner) and
        (ThemeTokenValueRevisionsTable.designSystemId eq owner) and
        (ThemeTokenValuesTable.tenantId eq tenant) and (ThemeTokenValueRevisionsTable.deleted eq false)
    tokenIds?.let { predicate = predicate and (ThemeTokenValuesTable.tokenId inList it.sorted()) }
    val values = reader.readProjected(predicate) { row ->
        val id = row.getObject(1, UUID::class.java)
        val tokenId = row.getObject(2, UUID::class.java)
        val token = tokens[tokenId] ?: return@readProjected null
        TenantTokenValue(
            id = id, tokenId = tokenId,
            tenantId = row.getObject(3, UUID::class.java), platform = row.getString(4), mode = row.getString(5),
            createdAt = row.getTimestamp(6).toInstant(), paletteId = row.getObject(7, UUID::class.java),
            value = row.getString(8)?.let(Json::parseToJsonElement), overridden = row.getBoolean(9),
            updatedAt = row.getTimestamp(10).toInstant(), editRevision = edits[id] ?: 0,
            tokenName = token.first, tokenType = token.second,
        )
    }
    if (!exactRevisions || values.isEmpty()) return values
    val revisions = entityEditRevisions(versionId, "token-value", values.mapTo(hashSetOf()) { it.id })
    return values.map { value ->
        val revision = revisions[value.id] ?: 0
        if (revision == value.editRevision) value else value.copy(editRevision = revision)
    }
}

private fun selectedValueEditRevisions(
    versionId: UUID,
    owner: UUID,
    tenant: UUID,
    tokenIds: Set<UUID>?,
): Map<UUID, Long> {
    val jdbc = BatchJdbc()
    val ids = tokenIds?.let(jdbc::uuids)
    return try {
        val sql = "SELECT edits.entity_id, edits.revision FROM entity_edit_states edits " +
            "JOIN token_values value ON value.id = edits.entity_id " +
            "WHERE edits.design_system_version_id = ? AND edits.entity_type = 'token-value' " +
            "AND edits.design_system_id = ? AND value.design_system_id = ? AND value.tenant_id = ?" +
            if (ids == null) "" else " AND value.token_id = ANY(?)"
        val arguments = listOf(versionId, owner, owner, tenant) + listOfNotNull(ids)
        jdbc.readArguments(sql, arguments) { row ->
            row.getObject(1, UUID::class.java) to row.getLong(2)
        }.toMap()
    } finally {
        ids?.free()
    }
}
