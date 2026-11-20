package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.BatchJdbc
import com.dsbuilder.ds.core.data.ResolvedSubjectRows
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import java.util.UUID

/**
 * Значения разрешённой темы на прежней границе; редакции читаются по точным UUID результата.
 * Полный ключ метаданных не зависит от оценки размеров таблиц при выборе соединения.
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
            ThemeTokenValueRevisionsTable.detached,
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
            updatedAt = row.getTimestamp(10).toInstant(), detached = row.getBoolean(11), editRevision = 0,
            tokenName = token.first, tokenType = token.second,
        )
    }
    if (values.isEmpty()) return values
    val revisions = selectedValueEditRevisions(versionId, values.map { it.id })
    return values.map { value ->
        val revision = revisions[value.id] ?: 0
        if (revision == value.editRevision) value else value.copy(editRevision = revision)
    }
}

private fun selectedValueEditRevisions(versionId: UUID, entityIds: List<UUID>): Map<UUID, Long> {
    val jdbc = BatchJdbc()
    return buildMap {
        for (batch in entityIds.chunked(5_000)) {
            val ids = jdbc.uuids(batch)
            try {
                val revisions = jdbc.read(
                    """
                    SELECT entity_id, revision FROM entity_edit_states
                    WHERE design_system_version_id = ? AND entity_type = 'token-value'
                      AND entity_id = ANY(?::uuid[])
                    """.trimIndent(),
                    versionId,
                    ids,
                ) { row -> row.getObject(1, UUID::class.java) to row.getLong(2) }
                putAll(revisions)
            } finally {
                ids.free()
            }
        }
    }
}
