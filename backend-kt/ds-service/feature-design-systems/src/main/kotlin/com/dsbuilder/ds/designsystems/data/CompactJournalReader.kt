package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.application.DraftChangeCandidate
import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DraftChangePolicy
import com.dsbuilder.ds.core.application.DraftSubjectChange
import com.dsbuilder.ds.core.application.JournalCandidateProjection
import com.dsbuilder.ds.core.application.JournalProjectionHandler
import com.dsbuilder.ds.core.application.JournalProjectionScope
import com.dsbuilder.ds.core.application.visitTenant
import com.dsbuilder.ds.core.data.populatedDraftHandlers
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DraftChange
import com.dsbuilder.ds.designsystems.domain.draftChangeDisplayCount
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.LongColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Порционное чтение минимальных отличий в уже проверенной транзакции журнала. */
internal class CompactJournalReader(
    private val handlers: List<DraftChangeHandler>,
    private val policies: List<DraftChangePolicy>,
    private val owner: DesignSystemId,
    private val versionId: UUID,
    private val sequence: Long,
    private val previous: Long,
    private val projections: List<JournalCandidateProjection> = emptyList(),
) {
    fun count(changes: List<DraftChange>): Int {
        val ids = changes.filter { it.entityType == "token-value" }
            .mapNotNull { tokenId(it.currentValue ?: it.previousValue) }.distinct()
        val types = ids.chunked(500).flatMap { tokenTypes(owner, sequence, it).entries }.associate { it.toPair() }
        return draftChangeDisplayCount(changes, types)
    }

    fun summary(change: (DraftChangeHandler, DraftSubjectChange) -> DraftChange): Int {
        var total = 0
        visitVisible { subject, batch ->
            val changes = batch.map { change(subject, it) }
            val ids = if (subject.entityType == "token-value") {
                batch.mapNotNull { tokenId(it.currentValue ?: it.previousValue) }.distinct()
            } else {
                emptyList()
            }
            val types = if (subject.entityType == "token-value") tokenTypes(owner, sequence, ids) else emptyMap()
            total = Math.addExact(total, draftChangeDisplayCount(changes, types))
        }
        return total
    }

    fun tokenIds(tenantId: UUID): Set<UUID>? {
        val exists = TransactionManager.current().exec(
            """
            SELECT 1 FROM tenants entity JOIN LATERAL (
                SELECT deleted FROM tenant_revisions revision WHERE revision.tenant_id = entity.id
                  AND revision.version_sequence_number <= ? ORDER BY revision.version_sequence_number DESC LIMIT 1
            ) current_revision ON NOT current_revision.deleted
            WHERE entity.id = ? AND entity.design_system_id = ?
            """.trimIndent(),
            listOf(LongColumnType() to sequence, UUIDColumnType() to tenantId, UUIDColumnType() to owner.value),
        ) { it.next() } ?: false
        if (!exists) return null
        val result = linkedSetOf<UUID>()
        visitVisible(setOf("token", "token-value"), tenantId) { subject, batch ->
            for (difference in batch) {
                if (subject.entityType == "token") {
                    result.add(difference.entityId)
                } else {
                    val value = difference.currentValue ?: difference.previousValue
                    if (value?.get("tenant_id")?.jsonPrimitive?.content == tenantId.toString()) {
                        tokenId(value)?.let(result::add)
                    }
                }
            }
        }
        return result
    }

    private fun tokenId(value: kotlinx.serialization.json.JsonObject?): UUID? = value?.get("token_id")
        ?.jsonPrimitive?.contentOrNull?.let { UUID.fromString(it) }

    private fun tokenTypes(owner: DesignSystemId, sequence: Long, ids: List<UUID>): Map<UUID, String?> {
        if (ids.isEmpty()) return emptyMap()
        return TransactionManager.current().exec(
            """
            SELECT entity.id, current_revision.type FROM tokens entity JOIN LATERAL (
                SELECT type, deleted FROM token_revisions revision WHERE revision.token_id = entity.id
                  AND revision.version_sequence_number <= ? ORDER BY revision.version_sequence_number DESC LIMIT 1
            ) current_revision ON NOT current_revision.deleted
            WHERE entity.design_system_id = ? AND entity.id IN (${ids.joinToString(",") { "?" }})
            """.trimIndent(),
            listOf(LongColumnType() to sequence, UUIDColumnType() to owner.value) + ids.map { UUIDColumnType() to it },
        ) { rows ->
            buildMap {
                while (rows.next()) put(rows.getObject("id", UUID::class.java), rows.getString("type"))
            }
        }.orEmpty()
    }

    private fun visitVisible(
        selectedTypes: Set<String>? = null,
        tenantId: UUID? = null,
        consume: (DraftChangeHandler, List<DraftSubjectChange>) -> Unit,
    ) {
        val tenantHandler = handlers.firstOrNull { it.entityType == "tenant" }
        val parentContext = mutableMapOf<UUID, DraftChangeCandidate?>()
        val prerequisites = projections.flatMap { it.requiredChangedTypes }.toSet()
        val indexed = handlers.filter {
            selectedTypes == null || it.entityType in selectedTypes || it.entityType in prerequisites
        }
        val populated = populatedDraftHandlers(indexed, owner.value, sequence, previous)
        val changedTypes = populated.mapTo(hashSetOf()) { it.entityType }
        for (handler in populated.filter { selectedTypes == null || it.entityType in selectedTypes }) {
            val consumeBatch: (List<DraftSubjectChange>) -> Unit = { batch ->
                // Новые темы — контекст политики, не дополнительные строки обрабатываемой порции.
                val parentIds = batch.filter { it.previousValue == null }.mapNotNull {
                    it.currentValue?.get("tenant_id")?.jsonPrimitive?.contentOrNull
                }.map(UUID::fromString).toSet()
                val missing = parentIds - parentContext.keys
                if (missing.isNotEmpty()) {
                    val found = tenantHandler?.describeEntities(owner.value, sequence, previous, missing)
                        .orEmpty().associate { it.entityId to DraftChangeCandidate("tenant", it) }
                    missing.forEach { id -> parentContext[id] = found[id] }
                }
                val parents = parentIds.mapNotNull { parentContext[it] }
                val keys = batch.mapTo(hashSetOf()) { it.entityId }
                val candidates = batch.map { DraftChangeCandidate(handler.entityType, it) } + parents
                val visible = policies.fold(candidates) { current, policy -> policy.visible(versionId, current) }
                val matching = visible.filter { it.entityType == handler.entityType && it.change.entityId in keys }
                consume(handler, matching.map { it.change })
            }
            val projection = projections.singleOrNull {
                handler is JournalProjectionHandler && it.entityType == handler.entityType &&
                    changedTypes.containsAll(it.requiredChangedTypes) && it.supports(policies)
            }
            if (projection != null) {
                projection.visit(JournalProjectionScope(owner.value, versionId, sequence, previous, tenantId)) { ids ->
                    consumeBatch(handler.describeEntities(owner.value, sequence, previous, ids.toSet()))
                }
            } else if (tenantId == null || handler.entityType != "token-value") {
                handler.visit(owner.value, sequence, previous, consumeBatch)
            } else {
                handler.visitTenant(owner.value, sequence, previous, tenantId, consumeBatch)
            }
        }
    }
}
