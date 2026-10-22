package com.dsbuilder.ds.designsystems

import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DraftSubjectChange
import com.dsbuilder.ds.designsystems.data.hasAnyDraftChanges
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertTrue

class DraftChangeExistenceTest {
    @Test
    fun `existence check does not build journal descriptions`() {
        val handler = object : DraftChangeHandler {
            override val entityType: String = "test"

            override fun describe(
                designSystemId: UUID,
                sequenceNumber: Long,
                previousSequenceNumber: Long,
                limit: Int?,
            ): List<DraftSubjectChange> = error("journal must not be materialized")

            override fun hasChanges(
                designSystemId: UUID,
                sequenceNumber: Long,
                previousSequenceNumber: Long,
            ): Boolean = true

            override fun revert(versionId: UUID, entityId: UUID, removeStableEntity: Boolean): Boolean = false
        }

        assertTrue(hasAnyDraftChanges(listOf(handler), UUID.randomUUID(), 2, 1))
    }
}
