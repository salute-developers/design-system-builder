package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.DraftInvalidation
import com.dsbuilder.ds.core.application.DraftInvalidationScope
import com.dsbuilder.ds.core.application.DraftInvalidationStream
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.postgresql.PGConnection
import java.sql.Connection
import java.sql.DriverManager
import java.time.Instant
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

/** PostgreSQL `LISTEN`-подписка, распространяющая подтверждённые изменения локальным SSE-соединениям. */
class PostgresDraftInvalidationStream(
    private val connectionFactory: () -> Connection,
) : DraftInvalidationStream, AutoCloseable {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val currentConnection = AtomicReference<Connection?>()
    private val mutableEvents = MutableSharedFlow<DraftInvalidation>(
        replay = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    private val mutableReconnections = MutableSharedFlow<Long>(
        extraBufferCapacity = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    override val events: Flow<DraftInvalidation> = mutableEvents
    override val reconnections: Flow<Long> = mutableReconnections

    init {
        scope.launch { listenForever() }
    }

    override fun close() {
        scope.cancel()
        runCatching { currentConnection.getAndSet(null)?.close() }
    }

    private suspend fun listenForever() {
        var subscribedBefore = false
        var reconnectionGeneration = 0L
        while (scope.isActive) {
            try {
                listenOnce {
                    if (subscribedBefore) mutableReconnections.tryEmit(++reconnectionGeneration)
                    subscribedBefore = true
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                if (scope.isActive) delay(RECONNECT_DELAY_MILLIS)
            } finally {
                currentConnection.set(null)
            }
        }
    }

    private fun listenOnce(onSubscribed: () -> Unit) {
        connectionFactory().use { connection ->
            currentConnection.set(connection)
            connection.autoCommit = true
            connection.createStatement().use { statement -> statement.execute("LISTEN $CHANNEL") }
            onSubscribed()
            val postgres = connection.unwrap(PGConnection::class.java)
            while (scope.isActive && !connection.isClosed) {
                postgres.getNotifications(HEARTBEAT_MILLIS)?.forEach { notification ->
                    parseDraftInvalidation(notification.parameter)?.let(mutableEvents::tryEmit)
                }
            }
        }
    }

    companion object {
        private const val CHANNEL = "ds_draft_invalidations"
        private const val HEARTBEAT_MILLIS = 15_000
        private const val RECONNECT_DELAY_MILLIS = 1_000L

        /** Создаёт поток с отдельным служебным соединением, не занимающим рабочий пул запросов. */
        fun create(jdbcUrl: String, user: String, password: String): PostgresDraftInvalidationStream =
            PostgresDraftInvalidationStream { DriverManager.getConnection(jdbcUrl, user, password) }
    }
}

internal fun parseDraftInvalidation(payload: String): DraftInvalidation? = runCatching {
    val value = Json.parseToJsonElement(payload).jsonObject
    val wireScopes = value["scopes"]?.jsonArray?.map { it.jsonPrimitive.content }.orEmpty()
    val parsedScopes = wireScopes.mapNotNull(DraftInvalidationScope::fromWire).toSet()
    DraftInvalidation(
        designSystemId = UUID.fromString(value.getValue("designSystemId").jsonPrimitive.content),
        draftId = UUID.fromString(value.getValue("draftId").jsonPrimitive.content),
        draftRevision = value.getValue("draftRevision").jsonPrimitive.content.toLong(),
        actorId = value.getValue("actorId").jsonPrimitive.content,
        clientId = value["clientId"]?.takeUnless { it is JsonNull }?.jsonPrimitive?.content,
        changedAt = Instant.parse(value.getValue("changedAt").jsonPrimitive.content),
        scopes = parsedScopes.takeIf { it.isNotEmpty() && it.size == wireScopes.size }
            ?: setOf(DraftInvalidationScope.ALL),
    )
}.getOrNull()
