package com.dsbuilder.ds.designsystems

import com.dsbuilder.ds.core.application.DraftInvalidation
import com.dsbuilder.ds.core.application.DraftInvalidationScope
import com.dsbuilder.ds.designsystems.presentation.DraftInvalidationConnectionLimiter
import com.dsbuilder.ds.designsystems.presentation.draftInvalidationGap
import com.dsbuilder.ds.designsystems.presentation.isOwnDraftInvalidation
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DraftInvalidationSecurityTest {
    @Test
    fun `same client id from another actor does not suppress invalidation`() {
        val event = invalidation(actorId = "actor-b", clientId = "shared-client")

        assertFalse(isOwnDraftInvalidation("actor-a", "shared-client", event))
        assertTrue(isOwnDraftInvalidation("actor-b", "shared-client", event))
    }

    @Test
    fun `connection limit is isolated by actor and releases leases`() {
        val limiter = DraftInvalidationConnectionLimiter(maximum = 2)
        val first = assertNotNull(limiter.tryAcquire("project", "actor"))
        val second = assertNotNull(limiter.tryAcquire("project", "actor"))

        assertNull(limiter.tryAcquire("project", "actor"))
        assertNotNull(limiter.tryAcquire("project", "other-actor")).close()
        first.close()
        assertNotNull(limiter.tryAcquire("project", "actor")).close()
        second.close()
    }

    @Test
    fun `revision gap requires full refresh even for the same draft`() {
        val draftId = UUID.randomUUID()

        assertFalse(draftInvalidationGap(invalidation(draftId = draftId, revision = 11), draftId, 10))
        assertTrue(draftInvalidationGap(invalidation(draftId = draftId, revision = 12), draftId, 10))
        assertTrue(draftInvalidationGap(invalidation(draftId = UUID.randomUUID(), revision = 1), draftId, 10))
    }

    private fun invalidation(
        actorId: String = "actor",
        clientId: String = "client",
        draftId: UUID = UUID.randomUUID(),
        revision: Long = 1,
    ) = DraftInvalidation(
        designSystemId = UUID.randomUUID(),
        draftId = draftId,
        draftRevision = revision,
        actorId = actorId,
        clientId = clientId,
        changedAt = Instant.EPOCH,
        scopes = setOf(DraftInvalidationScope.THEME_TOKENS),
    )
}
