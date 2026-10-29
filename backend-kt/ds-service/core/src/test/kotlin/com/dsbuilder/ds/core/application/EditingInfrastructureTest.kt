package com.dsbuilder.ds.core.application

import com.dsbuilder.ds.core.domain.DraftBoundaryRef
import com.dsbuilder.ds.core.domain.EntityEditState
import com.dsbuilder.ds.core.domain.LogicalEntityRef
import kotlinx.coroutines.runBlocking
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

class EditingInfrastructureTest {
    @Test
    fun `multiple entities are locked in stable order`() = runBlocking {
        val boundary = DraftBoundaryRef(UUID.randomUUID(), UUID.randomUUID(), 3)
        val second = LogicalEntityRef("token", UUID.fromString("00000000-0000-0000-0000-000000000002"))
        val first = LogicalEntityRef("appearance", UUID.fromString("00000000-0000-0000-0000-000000000001"))
        val locked = mutableListOf<LogicalEntityRef>()
        val repository = object : EntityEditStateRepository {
            override suspend fun lock(
                boundary: DraftBoundaryRef,
                entity: LogicalEntityRef,
                actorId: String,
            ): EntityEditState {
                locked += entity
                return EntityEditState(boundary, entity, 0, actorId, Instant.EPOCH)
            }

            override suspend fun changedPathsSince(
                boundary: DraftBoundaryRef,
                entity: LogicalEntityRef,
                revision: Long,
            ) = emptyList<com.dsbuilder.ds.core.domain.EntityEditPath>()

            override suspend fun advance(
                boundary: DraftBoundaryRef,
                entity: LogicalEntityRef,
                paths: Set<String>,
                actorId: String,
            ) = error("not used")
        }

        repository.lockAll(boundary, listOf(second, first, second), "actor")

        assertEquals(listOf(first, second), locked)
    }

    @Test
    fun `request hash is stable`() {
        assertEquals(
            "015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862",
            RequestHash.sha256("{\"a\":1}".encodeToByteArray()),
        )
    }
}
