package com.dsbuilder.ai.chat.data

import com.dsbuilder.ai.chat.application.EventsResult
import com.dsbuilder.ai.chat.application.StopResult
import com.dsbuilder.ai.chat.application.TurnKeys
import com.dsbuilder.ai.chat.application.TurnLookup
import com.dsbuilder.ai.chat.application.TurnOwner
import com.dsbuilder.ai.chat.application.TurnRegistration
import com.dsbuilder.ai.chat.application.TurnStore
import com.dsbuilder.ai.chat.domain.ChatEvent
import com.dsbuilder.ai.chat.domain.StoredEvent
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * Ходы чата в памяти одного процесса.
 *
 * Все изменения выполняются под одной блокировкой: нагрузка — один активный ход на пользователя.
 * Связи `Idempotency-Key → turnId` и `хеш токена → turnId` хранятся отдельно от событий и по объёму
 * не вытесняются, поэтому повтор после вытеснения получает прежний ход, а не запускает новый.
 */
@Suppress("TooManyFunctions")
internal class InMemoryTurnStore(
    private val maxBytes: Long,
    private val clock: Clock = Clock.systemUTC(),
    private val retention: Duration = Duration.ofMinutes(RETENTION_MINUTES),
    private val maxStreamsPerUser: Int = MAX_STREAMS_PER_USER,
    /** Предел новых ходов пользователя за скользящий час. */
    private val maxTurnsPerHour: Int = Int.MAX_VALUE,
    /** Предел одновременно идущих ходов всех пользователей. */
    private val maxConcurrentTurns: Int = Int.MAX_VALUE,
) : TurnStore {
    /** Моменты начала ходов пользователя за последний час; повторы принятых запросов сюда не попадают. */
    private val startsByUser = HashMap<String, ArrayDeque<Instant>>()
    private val lock = Any()
    private val turns = LinkedHashMap<String, Turn>()
    private val keyLinks = HashMap<KeyRef, KeyLink>()
    private val tokenLinks = HashMap<String, TokenLink>()
    private val activeByUser = HashMap<String, String>()
    private val streamsByUser = HashMap<String, Int>()
    private var totalBytes = 0L

    override fun find(keys: TurnKeys): TurnLookup = synchronized(lock) {
        purge()
        lookup(keys)
    }

    override fun register(keys: TurnKeys, inputBytes: Long): TurnRegistration = synchronized(lock) {
        purge()
        when (val existing = lookup(keys)) {
            is TurnLookup.Existing -> return TurnRegistration.Existing(existing.turnId)
            TurnLookup.KeyReused -> return TurnRegistration.KeyReused
            TurnLookup.ConfirmationScopeMismatch -> return TurnRegistration.ConfirmationScopeMismatch
            TurnLookup.NotFound -> Unit
        }
        activeByUser[keys.owner.userId]?.let { active ->
            val turn = turns.getValue(active)
            return TurnRegistration.Busy(active, turn.owner.projectId, turn.designSystemId)
        }
        // Решение по подтверждению в лимит не засчитывается: предложенную операцию можно подтвердить и на пределе.
        val counted = keys.confirmationTokenHash == null
        val now = clock.instant()
        limitRejection(keys.owner.userId, counted, now)?.let { return it }
        if (!reserve(inputBytes)) return TurnRegistration.Overloaded
        if (counted) startsByUser.getOrPut(keys.owner.userId) { ArrayDeque() }.addLast(now)
        val turnId = UUID.randomUUID().toString()
        turns[turnId] = Turn(turnId, keys.owner, keys.designSystemId, inputBytes).also {
            it.countedAt = now.takeIf { counted }
        }
        totalBytes += inputBytes
        keyLinks[KeyRef(keys.owner, keys.idempotencyKey)] = KeyLink(turnId, keys.fingerprint)
        keys.confirmationTokenHash?.let { hash ->
            tokenLinks[hash] = TokenLink(turnId, keys.owner, keys.designSystemId)
        }
        activeByUser[keys.owner.userId] = turnId
        TurnRegistration.Started(turnId)
    }

    /** Общий предел параллельных ходов и часовой предел пользователя; окно уже очищено в purge(). */
    private fun limitRejection(userId: String, counted: Boolean, now: Instant): TurnRegistration? {
        val starts = startsByUser[userId].orEmpty()
        return when {
            activeByUser.size >= maxConcurrentTurns -> TurnRegistration.Overloaded
            !counted || starts.size < maxTurnsPerHour -> null
            else -> {
                val wait = Duration.between(now, starts.first().plus(HOUR))
                TurnRegistration.RateLimited(((wait.toMillis() + MILLIS - 1) / MILLIS).coerceAtLeast(1))
            }
        }
    }

    override fun cancelRegistration(turnId: String): Unit = synchronized(lock) {
        val turn = turns.remove(turnId) ?: return
        totalBytes -= turn.bytes
        // Ход не стартовал: возвращаем засчитанный момент в окно.
        turn.countedAt?.let { at -> startsByUser[turn.owner.userId]?.remove(at) }
        keyLinks.values.removeIf { it.turnId == turnId }
        tokenLinks.values.removeIf { it.turnId == turnId }
        activeByUser.remove(turn.owner.userId, turnId)
        turn.version.value = Long.MAX_VALUE
    }

    override fun append(turnId: String, event: ChatEvent, bytes: Long): StoredEvent = synchronized(lock) {
        val turn = turns.getValue(turnId)
        val stored = StoredEvent(turn.events.size + 1L, event)
        turn.events += stored
        turn.bytes += bytes
        totalBytes += bytes
        turn.version.value = stored.id
        stored
    }

    override fun complete(turnId: String): Unit = synchronized(lock) {
        val turn = turns[turnId] ?: return
        if (turn.completedAt == null) turn.completedAt = clock.instant()
        activeByUser.remove(turn.owner.userId, turnId)
        val completedAt = turn.completedAt
        keyLinks.values.filter { it.turnId == turnId }.forEach { it.completedAt = completedAt }
        tokenLinks.values.filter { it.turnId == turnId }.forEach { it.completedAt = completedAt }
        turn.version.value = turn.version.value + 1
        evictIfNeeded()
    }

    override fun isStopRequested(turnId: String): Boolean = synchronized(lock) { turns[turnId]?.stopRequested == true }

    override fun events(turnId: String, owner: TurnOwner, afterId: Long?): EventsResult = synchronized(lock) {
        purge()
        val turn = turns[turnId]?.takeIf { it.owner == owner } ?: return EventsResult.Unknown
        val streams = streamsByUser[owner.userId] ?: 0
        if (streams >= maxStreamsPerUser) return EventsResult.TooManyStreams
        streamsByUser[owner.userId] = streams + 1
        var released = false
        val release = {
            synchronized(lock) {
                if (!released) {
                    released = true
                    streamsByUser.computeIfPresent(owner.userId) { _, count -> (count - 1).takeIf { it > 0 } }
                }
            }
        }
        EventsResult.Stream(stream(turn, afterId ?: 0L), release)
    }

    override fun stop(turnId: String, owner: TurnOwner): StopResult = synchronized(lock) {
        val turn = turns[turnId]?.takeIf { it.owner == owner } ?: return StopResult.UNKNOWN
        if (turn.completedAt != null) return StopResult.ALREADY_COMPLETED
        turn.stopRequested = true
        StopResult.STOPPED
    }

    /** Снимок и ожидание новых версий берутся под одной блокировкой: события не теряются и не повторяются. */
    private fun stream(turn: Turn, after: Long): Flow<StoredEvent> = flow {
        var cursor = after
        while (true) {
            val (batch, version, completed) = synchronized(lock) {
                Triple(turn.events.filter { it.id > cursor }, turn.version.value, turn.completedAt != null)
            }
            batch.forEach {
                emit(it)
                cursor = it.id
            }
            // После завершения события не добавляются, поэтому снимок завершённого хода полон.
            if (completed || version == Long.MAX_VALUE) return@flow
            turn.version.first { it != version }
        }
    }

    private fun lookup(keys: TurnKeys): TurnLookup {
        val keyLink = keyLinks[KeyRef(keys.owner, keys.idempotencyKey)]
        return when {
            keyLink == null -> lookupToken(keys)
            keyLink.fingerprint == keys.fingerprint -> TurnLookup.Existing(keyLink.turnId)
            else -> TurnLookup.KeyReused
        }
    }

    private fun lookupToken(keys: TurnKeys): TurnLookup {
        val link = keys.confirmationTokenHash?.let { tokenLinks[it] } ?: return TurnLookup.NotFound
        return if (link.owner == keys.owner && link.designSystemId == keys.designSystemId) {
            TurnLookup.Existing(link.turnId)
        } else {
            TurnLookup.ConfirmationScopeMismatch
        }
    }

    /**
     * Освобождает место вытеснением самых старых завершённых ходов; идущие не трогает.
     * Если идущих ходов нет, принимает даже запрос больше лимита: иначе такой запрос не прошёл бы никогда.
     */
    private fun reserve(bytes: Long): Boolean {
        evictIfNeeded(extra = bytes)
        return totalBytes + bytes <= maxBytes || turns.values.none { it.completedAt == null }
    }

    private fun evictIfNeeded(extra: Long = 0) {
        val iterator = turns.values.iterator()
        while (totalBytes + extra > maxBytes && iterator.hasNext()) {
            val turn = iterator.next()
            if (turn.completedAt != null) {
                totalBytes -= turn.bytes
                turn.version.value = Long.MAX_VALUE
                iterator.remove()
            }
        }
    }

    private fun purge() {
        val hourAgo = clock.instant().minus(HOUR)
        startsByUser.values.forEach { starts ->
            while (starts.isNotEmpty() && !starts.first().isAfter(hourAgo)) starts.removeFirst()
        }
        startsByUser.values.removeIf { it.isEmpty() }
        val threshold = clock.instant().minus(retention)
        val expired = turns.values.filter { it.completedAt?.isBefore(threshold) == true }
        expired.forEach { turn ->
            totalBytes -= turn.bytes
            turns.remove(turn.id)
        }
        keyLinks.values.removeIf { it.completedAt?.isBefore(threshold) == true }
        tokenLinks.values.removeIf { it.completedAt?.isBefore(threshold) == true }
    }

    private class Turn(val id: String, val owner: TurnOwner, val designSystemId: String, var bytes: Long) {
        /** Момент, засчитанный в часовой лимит; null — ход в лимит не засчитан (решение по подтверждению). */
        var countedAt: Instant? = null
        val events = mutableListOf<StoredEvent>()
        val version = MutableStateFlow(0L)
        var completedAt: Instant? = null
        var stopRequested = false
    }

    private data class KeyRef(val owner: TurnOwner, val idempotencyKey: String)

    private class KeyLink(val turnId: String, val fingerprint: String) {
        var completedAt: Instant? = null
    }

    private class TokenLink(val turnId: String, val owner: TurnOwner, val designSystemId: String) {
        var completedAt: Instant? = null
    }

    private companion object {
        private val HOUR: Duration = Duration.ofHours(1)
        private const val MILLIS = 1_000L
        const val RETENTION_MINUTES = 10L
        const val MAX_STREAMS_PER_USER = 3
    }
}
