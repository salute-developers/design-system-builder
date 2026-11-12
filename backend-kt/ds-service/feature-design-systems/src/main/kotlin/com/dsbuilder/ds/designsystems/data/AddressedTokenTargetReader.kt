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
    val tenantId: UUID,
    val tokenIds: Set<UUID>,
)

/** Ограниченное чтение области, её отпечатка и страниц без обращения к общему журналу. */
internal class AddressedTokenTargetReader(
    private val scope: TokenTargetScope,
    private val handlers: Map<String, DraftChangeHandler>,
    private val describe: (String, UUID) -> DraftChange?,
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
                val changes = rows.mapNotNull { describe(it.getValue("entity_type")!!, UUID.fromString(it["id"])) }
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
                        changes.map {
                            listOf(
                                it.entityType,
                                it.entityId,
                                it.editRevision,
                                it.previousValue,
                                it.currentValue,
                            )
                        },
                    ),
                )
                page(changes, fingerprint, cursor)
            }
        }
    }

    private fun missing(cursor: String?) = DsResult.Failure(
        if (cursor == null) DsFailure.NotFound else DsFailure.Conflict("TARGET_SNAPSHOT_CHANGED"),
    )

    private fun page(changes: List<DraftChange>, fingerprint: String, cursor: String?): DsResult<DraftTokenTargetPage> {
        val offset = when (val result = offset(cursor, fingerprint, changes.size)) {
            is DsResult.Failure -> return result
            is DsResult.Success -> result.value
        }
        val targets = changes.drop(offset).take(200).map {
            DraftTokenTarget(DraftAddressTarget(it.entityType, it.entityId, it.editRevision), it.operation.wireValue)
        }
        val next = (offset + targets.size).takeIf { it < changes.size }?.let {
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
                if (offset < 0 || offset > size || offset % 200 != 0) invalidCursor() else DsResult.Success(offset)
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
                SELECT 'token-value',id FROM token_values
                WHERE design_system_id=? AND tenant_id=? AND token_id=ANY(?)
                ORDER BY entity_type,id
        """.trimIndent(),
        scope.designSystemId,
        jdbc.uuids(scope.tokenIds),
        scope.designSystemId,
        scope.tenantId,
        jdbc.uuids(scope.tokenIds),
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
}
