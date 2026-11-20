package com.dsbuilder.ai.chat.data

import com.dsbuilder.ai.chat.application.EventsResult
import com.dsbuilder.ai.chat.application.StopResult
import com.dsbuilder.ai.chat.application.TurnKeys
import com.dsbuilder.ai.chat.application.TurnLookup
import com.dsbuilder.ai.chat.application.TurnOwner
import com.dsbuilder.ai.chat.application.TurnRegistration
import com.dsbuilder.ai.chat.domain.ChatEvent
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class InMemoryTurnStoreTest {
    private val owner = TurnOwner("user", "project")
    private fun keys(
        key: String = "k1",
        fingerprint: String = "fp",
        token: String? = null,
        owner: TurnOwner = this.owner,
        ds: String = "ds",
    ) =
        TurnKeys(owner, ds, key, fingerprint, token)

    private fun TurnRegistration.id() = (this as TurnRegistration.Started).turnId

    @Test
    fun sameKeySameBodyReturnsTheTurnAndOtherBodyIsKeyReused() {
        val store = InMemoryTurnStore(1_000_000)
        val turnId = store.register(keys(), 0).id()

        assertEquals(TurnLookup.Existing(turnId), store.find(keys()))
        assertEquals(TurnLookup.KeyReused, store.find(keys(fingerprint = "other")))
        assertEquals(TurnRegistration.KeyReused, store.register(keys(fingerprint = "other"), 0))
        assertEquals(TurnLookup.NotFound, store.find(keys(owner = TurnOwner("user", "project-2"))))
    }

    @Test
    fun sameTokenFromAnotherTabReturnsTheTurnButAnotherScopeIsMismatch() {
        val store = InMemoryTurnStore(1_000_000)
        val turnId = store.register(keys(token = "hash"), 0).id()

        assertEquals(TurnLookup.Existing(turnId), store.find(keys(key = "k2", token = "hash")))
        assertEquals(TurnLookup.ConfirmationScopeMismatch, store.find(keys(key = "k3", token = "hash", ds = "ds-2")))
    }

    @Test
    fun busyCarriesTheActiveTurnAndSlotFreesOnComplete() {
        val store = InMemoryTurnStore(1_000_000)
        val turnId = store.register(keys(), 0).id()

        assertEquals(TurnRegistration.Busy(turnId, "project", "ds"), store.register(keys(key = "k2"), 0))
        store.complete(turnId)
        assertIs<TurnRegistration.Started>(store.register(keys(key = "k2"), 0))
    }

    @Test
    fun cancelRegistrationRemovesLinksAndSlot() {
        val store = InMemoryTurnStore(1_000_000)
        val turnId = store.register(keys(token = "hash"), 0).id()
        store.cancelRegistration(turnId)

        assertEquals(TurnLookup.NotFound, store.find(keys(token = "hash")))
        assertIs<TurnRegistration.Started>(store.register(keys(token = "hash"), 0))
    }

    @Test
    fun subscriptionGetsEveryEventOnceWhileTheTurnAppends() = runBlocking<Unit> {
        val store = InMemoryTurnStore(1_000_000)
        val turnId = store.register(keys(), 0).id()
        store.append(turnId, ChatEvent.Message("1"), 1)
        val reader = async {
            (store.events(turnId, owner, 0) as EventsResult.Stream).flow.toList().map { it.id }
        }
        repeat(20) {
            delay(1)
            store.append(turnId, ChatEvent.Message("${it + 2}"), 1)
        }
        store.append(turnId, ChatEvent.Done, 1)
        store.complete(turnId)

        assertEquals((1L..22L).toList(), withTimeout(5_000) { reader.await() })
        val tail = (store.events(turnId, owner, 20) as EventsResult.Stream).flow.toList().map { it.id }
        assertEquals(listOf(21L, 22L), tail)
    }

    @Test
    fun onlyCompletedTurnsAreEvictedAndLinksSurvive() {
        val store = InMemoryTurnStore(maxBytes = 100)
        val done = store.register(keys(key = "old", token = "hash"), 60).id()
        store.complete(done)
        val running = store.register(keys(key = "new", owner = TurnOwner("user-2", "project")), 60).id()

        assertEquals(EventsResult.Unknown, store.events(done, owner, null))
        assertIs<EventsResult.Stream>(store.events(running, TurnOwner("user-2", "project"), null))
        assertEquals(TurnLookup.Existing(done), store.find(keys(key = "old", token = "hash")))
        assertEquals(TurnRegistration.Existing(done), store.register(keys(key = "other", token = "hash"), 0))
    }

    @Test
    fun overloadedWhenRunningTurnsFillMemory() {
        val store = InMemoryTurnStore(maxBytes = 100)
        store.register(keys(key = "a"), 90)
        assertEquals(
            TurnRegistration.Overloaded,
            store.register(keys(key = "b", owner = TurnOwner("user-2", "project")), 50),
        )
    }

    @Test
    fun foreignOwnerAndProjectSeeUnknownAndStop() {
        val store = InMemoryTurnStore(1_000_000)
        val turnId = store.register(keys(), 0).id()

        assertEquals(EventsResult.Unknown, store.events(turnId, TurnOwner("other", "project"), null))
        assertEquals(EventsResult.Unknown, store.events(turnId, TurnOwner("user", "project-2"), null))
        assertEquals(StopResult.UNKNOWN, store.stop(turnId, TurnOwner("other", "project")))
        assertEquals(StopResult.STOPPED, store.stop(turnId, owner))
        store.complete(turnId)
        assertEquals(StopResult.ALREADY_COMPLETED, store.stop(turnId, owner))
    }

    @Test
    fun fourthStreamIsRejectedUntilOneIsReleased() {
        val store = InMemoryTurnStore(1_000_000)
        val turnId = store.register(keys(), 0).id()
        val streams = (1..3).map { store.events(turnId, owner, null) as EventsResult.Stream }

        assertEquals(EventsResult.TooManyStreams, store.events(turnId, owner, null))
        streams.first().release()
        assertIs<EventsResult.Stream>(store.events(turnId, owner, null))
    }

    @Test
    fun hourlyLimitCountsOnlyNewTurnsAndFreesAfterAnHour() {
        var now = Instant.parse("2026-11-19T10:00:00Z")
        val clock = object : Clock() {
            override fun getZone() = ZoneOffset.UTC
            override fun withZone(zone: java.time.ZoneId?) = this
            override fun instant() = now
        }
        val store = InMemoryTurnStore(1_000_000, clock, maxTurnsPerHour = 2)
        repeat(2) { index ->
            val turnId = store.register(keys(key = "k$index"), 0).id()
            assertEquals(TurnRegistration.Existing(turnId), store.register(keys(key = "k$index"), 0))
            store.complete(turnId)
        }

        val limited = assertIs<TurnRegistration.RateLimited>(store.register(keys(key = "k3"), 0))
        assertEquals(3_600L, limited.retryAfterSeconds)
        assertIs<TurnRegistration.Started>(store.register(keys(key = "k3", owner = TurnOwner("user-2", "project")), 0))

        now = now.plusSeconds(3_601)
        assertIs<TurnRegistration.Started>(store.register(keys(key = "k3"), 0))
    }

    @Test
    fun cancelledTurnAndConfirmationDoNotSpendTheHourlyLimit() {
        var now = Instant.parse("2026-11-19T10:00:00Z")
        val clock = object : Clock() {
            override fun getZone() = ZoneOffset.UTC
            override fun withZone(zone: java.time.ZoneId?) = this
            override fun instant() = now
        }
        val store = InMemoryTurnStore(1_000_000, clock, maxTurnsPerHour = 1)
        store.cancelRegistration(store.register(keys(key = "cancelled"), 0).id())
        store.complete(store.register(keys(key = "first"), 0).id())

        assertIs<TurnRegistration.RateLimited>(store.register(keys(key = "second"), 0))
        store.complete(store.register(keys(key = "confirm", token = "hash"), 0).id())

        now = now.plusMillis(500)
        val limited = assertIs<TurnRegistration.RateLimited>(store.register(keys(key = "third"), 0))
        assertEquals(3_600L, limited.retryAfterSeconds, "59 min 59.5 s rounds up to a full hour")
    }

    @Test
    fun continuationAfterConfirmationSpendsTheHourlyLimitOnce() {
        var now = Instant.parse("2026-11-19T10:00:00Z")
        val clock = object : Clock() {
            override fun getZone() = ZoneOffset.UTC
            override fun withZone(zone: java.time.ZoneId?) = this
            override fun instant() = now
        }
        val store = InMemoryTurnStore(1_000_000, clock, maxTurnsPerHour = 1)
        val confirmed = store.register(keys(key = "confirm", token = "hash"), 0).id()

        assertEquals(null, store.chargeContinuation(confirmed))
        assertEquals(null, store.chargeContinuation(confirmed), "an already counted turn is not charged twice")
        store.complete(confirmed)

        val next = store.register(keys(key = "confirm-2", token = "hash-2"), 0).id()
        now = now.plusSeconds(600)
        assertEquals(3_000L, store.chargeContinuation(next))
        store.complete(next)
        assertEquals(
            3_000L,
            assertIs<TurnRegistration.RateLimited>(store.register(keys(key = "plain"), 0)).retryAfterSeconds,
        )

        now = now.plusSeconds(3_001)
        assertIs<TurnRegistration.Started>(store.register(keys(key = "after-hour"), 0))
    }

    @Test
    fun concurrentLimitIsShared() {
        val store = InMemoryTurnStore(1_000_000, maxConcurrentTurns = 1)
        store.register(keys(key = "a"), 0).id()

        assertEquals(
            TurnRegistration.Overloaded,
            store.register(keys(key = "b", owner = TurnOwner("user-2", "project")), 0),
        )
    }

    @Test
    fun completedTurnsExpireAfterRetention() {
        var now = Instant.parse("2026-11-17T10:00:00Z")
        val clock = object : Clock() {
            override fun getZone() = ZoneOffset.UTC
            override fun withZone(zone: java.time.ZoneId?) = this
            override fun instant() = now
        }
        val store = InMemoryTurnStore(1_000_000, clock)
        val turnId = store.register(keys(), 0).id()
        store.complete(turnId)
        now = now.plusSeconds(11 * 60)

        assertEquals(TurnLookup.NotFound, store.find(keys()))
        assertEquals(EventsResult.Unknown, store.events(turnId, owner, null))
    }
}
