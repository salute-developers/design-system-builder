package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.RequestHash
import com.dsbuilder.ds.core.data.BatchJdbc
import com.dsbuilder.ds.designsystems.application.DraftAddressTarget
import com.dsbuilder.ds.designsystems.application.DraftTokenTarget
import com.dsbuilder.ds.designsystems.application.DraftTokenTargetPage
import com.dsbuilder.ds.designsystems.domain.DraftChange
import java.util.Base64
import java.util.UUID

/** Только выбранные определения и значения одной темы на согласованной границе. */
internal data class TokenTargetScope(
    val designSystemId: UUID,
    val draftId: UUID,
    val sequenceNumber: Long,
    val previousSequenceNumber: Long,
    val tenantId: UUID,
    val tokenIds: Set<UUID>,
)

/** Ограниченное чтение области, её отпечатка и страниц без обращения к общему журналу. */
internal class AddressedTokenTargetReader(
    private val scope: TokenTargetScope,
    private val handlers: Map<String, DraftChangeHandler>,
    private val describe: (List<Pair<String, UUID>>) -> List<DraftChange>,
) {
    private val jdbc = BatchJdbc()

    fun read(cursor: String?): DsResult<DraftTokenTargetPage> {
        val tenant = tenant()
        return if (tenant.isEmpty()) missing(cursor) else targets(tenant, cursor)
    }

    private fun targets(tenant: List<Map<String, String?>>, cursor: String?): DsResult<DraftTokenTargetPage> {
        val rows = candidates()
        return when {
            rows.count { it["entity_type"] == "token" } != scope.tokenIds.size -> missing(cursor)
            listOf("token", "token-value").any { handlers[it]?.supportsAddressedRevert != true } ->
                DsResult.Failure(DsFailure.InvalidRequest("invalid_entity_type"))
            else -> {
                val valueIds = rows.filter { it["entity_type"] == "token-value" }.map { UUID.fromString(it["id"]) }
                val fingerprint = RequestHash.canonical(
                    listOf(
                        scope.designSystemId,
                        scope.draftId,
                        scope.tenantId,
                        tenant,
                        scope.tokenIds.map(UUID::toString).sorted(),
                        rows,
                        revisions(valueIds),
                    ),
                )
                page(rows, fingerprint, cursor)
            }
        }
    }

    private fun missing(cursor: String?) = DsResult.Failure(
        if (cursor == null) DsFailure.NotFound else DsFailure.Conflict("TARGET_SNAPSHOT_CHANGED"),
    )

    private fun page(
        rows: List<Map<String, String?>>,
        fingerprint: String,
        cursor: String?,
    ): DsResult<DraftTokenTargetPage> {
        var offset = when (val result = offset(cursor, fingerprint, rows.size)) {
            is DsResult.Failure -> return result
            is DsResult.Success -> result.value
        }
        val targets = mutableListOf<DraftTokenTarget>()
        while (offset < rows.size && targets.size < PAGE_SIZE) {
            val batch = rows.subList(offset, minOf(offset + PAGE_SIZE, rows.size)).map {
                it.getValue("entity_type")!! to UUID.fromString(it.getValue("id"))
            }
            val changes = describe(batch).associateBy { it.entityType to it.entityId }
            for (address in batch) {
                offset++
                changes[address]?.let {
                    targets += DraftTokenTarget(
                        DraftAddressTarget(it.entityType, it.entityId, it.editRevision), it.operation.wireValue,
                    )
                }
                if (targets.size == PAGE_SIZE) break
            }
        }
        val next = offset.takeIf { it < rows.size }?.let {
            Base64.getUrlEncoder().withoutPadding().encodeToString("$fingerprint:$it".toByteArray(Charsets.UTF_8))
        }
        return DsResult.Success(DraftTokenTargetPage(scope.draftId, fingerprint, targets, next))
    }

    private fun offset(cursor: String?, fingerprint: String, size: Int): DsResult<Int> {
        val parts = cursor?.let {
            runCatching {
                String(Base64.getUrlDecoder().decode(it), Charsets.UTF_8).split(':')
            }.getOrNull()
        }
        return when {
            cursor == null -> DsResult.Success(0)
            parts == null || parts.size != 2 || parts[1].toIntOrNull() == null -> invalidCursor()
            parts[0] != fingerprint -> DsResult.Failure(DsFailure.Conflict("TARGET_SNAPSHOT_CHANGED"))
            else -> {
                val offset = parts[1].toInt()
                if (offset < 0 || offset > size) invalidCursor() else DsResult.Success(offset)
            }
        }
    }

    private fun invalidCursor() = DsResult.Failure(DsFailure.InvalidRequest("invalid_target_cursor"))

    private fun tenant(): List<Map<String, String?>> = jdbc.query(
        """
                SELECT n.* FROM tenants t JOIN LATERAL (SELECT * FROM tenant_revisions n
                  WHERE n.tenant_id=t.id AND n.version_sequence_number<=?
                  ORDER BY n.version_sequence_number DESC LIMIT 1) n ON NOT n.deleted
                WHERE t.id=? AND t.design_system_id=?
        """.trimIndent(),
        scope.sequenceNumber,
        scope.tenantId,
        scope.designSystemId,
    )

    private fun candidates(): List<Map<String, String?>> = jdbc.query(
        """
                SELECT 'token' AS entity_type,id FROM tokens WHERE design_system_id=? AND id=ANY(?)
                UNION ALL
                SELECT 'token-value',v.id FROM token_values v
                WHERE v.design_system_id=? AND v.tenant_id=? AND v.token_id=ANY(?)
                  AND EXISTS (SELECT 1 FROM token_value_revisions r WHERE r.token_value_id=v.id
                    AND r.version_sequence_number>? AND r.version_sequence_number<=?)
                ORDER BY entity_type,id
        """.trimIndent(),
        scope.designSystemId,
        jdbc.uuids(scope.tokenIds),
        scope.designSystemId,
        scope.tenantId,
        jdbc.uuids(scope.tokenIds),
        scope.previousSequenceNumber,
        scope.sequenceNumber,
    )

    private fun revisions(valueIds: List<UUID>): List<Map<String, String?>> = jdbc.query(
        """
                SELECT entity_type,entity_id,revision FROM entity_edit_states WHERE design_system_version_id=?
                  AND entity_type='token' AND entity_id=ANY(?)
                UNION ALL
                SELECT entity_type,entity_id,revision FROM entity_edit_states WHERE design_system_version_id=?
                  AND entity_type='token-value' AND entity_id=ANY(?)
                ORDER BY entity_type,entity_id
        """.trimIndent(),
        scope.draftId,
        jdbc.uuids(scope.tokenIds),
        scope.draftId,
        jdbc.uuids(valueIds),
    )
    private companion object {
        const val PAGE_SIZE = 200
    }
}
