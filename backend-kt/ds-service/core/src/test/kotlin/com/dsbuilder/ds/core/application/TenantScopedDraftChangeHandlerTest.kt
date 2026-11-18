package com.dsbuilder.ds.core.application

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

/** Делегирование не обходит фильтры обёртки, оптимизация темы подключается явно. */
class TenantScopedDraftChangeHandlerTest {
    @Test
    fun `tenant visit preserves wrapper filter unless scoped capability is explicitly implemented`() {
        val id = UUID.randomUUID()
        val change = DraftSubjectChange(id, null, null, emptySet())
        var scopedCalls = 0
        val delegate = object : DraftChangeHandler, TenantScopedDraftChangeHandler {
            override val entityType = "test"
            override fun describe(
                designSystemId: UUID,
                sequenceNumber: Long,
                previousSequenceNumber: Long,
                limit: Int?,
            ) = listOf(change)
            override fun revert(versionId: UUID, entityId: UUID, removeStableEntity: Boolean) = false
            override fun visitTenant(
                designSystemId: UUID,
                sequenceNumber: Long,
                previousSequenceNumber: Long,
                tenantId: UUID,
                consume: (List<DraftSubjectChange>) -> Unit,
            ) {
                scopedCalls++
                consume(listOf(change))
            }
        }
        val filtered = object : DraftChangeHandler by delegate {
            override fun visit(
                designSystemId: UUID,
                sequenceNumber: Long,
                previousSequenceNumber: Long,
                consume: (List<DraftSubjectChange>) -> Unit,
            ) {
                delegate.visit(designSystemId, sequenceNumber, previousSequenceNumber) { batch ->
                    consume(batch.filter { it.entityId != id })
                }
            }
        }
        val visible = mutableListOf<DraftSubjectChange>()
        filtered.visitTenant(id, 1, 0, id) { visible.addAll(it) }
        assertEquals(emptyList(), visible)
        assertEquals(0, scopedCalls)
        val explicit: DraftChangeHandler = object :
            DraftChangeHandler by delegate,
            TenantScopedDraftChangeHandler by delegate {}
        explicit.visitTenant(id, 1, 0, id) { visible.addAll(it) }
        assertEquals(listOf(change), visible)
        assertEquals(1, scopedCalls)
    }
}
