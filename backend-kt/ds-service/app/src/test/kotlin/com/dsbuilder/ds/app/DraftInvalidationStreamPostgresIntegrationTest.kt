package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.data.PostgresDraftInvalidationStream
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.sql.DriverManager
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class DraftInvalidationStreamPostgresIntegrationTest {
    @Test
    fun `startup overflow and lost LISTEN produce reconciliation signals`() = runBlocking {
        IsolatedPostgresDatabase.create().use { database ->
            val subscribe = CountDownLatch(1)
            val backend = AtomicInteger()
            val signals = Channel<Long>(Channel.UNLIMITED)
            val resume = CompletableDeferred<Unit>()
            val received = CompletableDeferred<Unit>()
            PostgresDraftInvalidationStream {
                check(subscribe.await(5, TimeUnit.SECONDS))
                connect(database).also { connection ->
                    connection.createStatement().use { statement ->
                        statement.executeQuery("SELECT pg_backend_pid()").use { rows ->
                            rows.next()
                            backend.set(rows.getInt(1))
                        }
                    }
                }
            }.use { stream ->
                val reconnections = launch(start = CoroutineStart.UNDISPATCHED) {
                    stream.reconnections.collect { signals.send(it) }
                }
                val slowReader = launch(start = CoroutineStart.UNDISPATCHED) {
                    stream.events.collect {
                        received.complete(Unit)
                        resume.await()
                    }
                }
                try {
                    subscribe.countDown()
                    assertEquals(1L, withTimeout(10_000) { signals.receive() })
                    publishBurst(database)
                    withTimeout(10_000) { received.await() }
                    assertNotEquals(1L, withTimeout(10_000) { signals.receive() })
                    slowReader.cancelAndJoin()
                    verifyReconnect(database, backend.get(), signals)
                } finally {
                    resume.complete(Unit)
                    slowReader.cancelAndJoin()
                    reconnections.cancelAndJoin()
                    signals.close()
                }
            }
        }
    }

    private fun publishBurst(database: IsolatedPostgresDatabase) {
        val owner = UUID.randomUUID()
        val draft = UUID.randomUUID()
        connect(database).use { connection ->
            connection.autoCommit = false
            connection.prepareStatement("SELECT pg_notify('ds_draft_invalidations', ?)").use { statement ->
                repeat(600) {
                    statement.setString(
                        1,
                        """{"eventId":"${UUID.randomUUID()}","designSystemId":"$owner","draftId":"$draft",
                            "actorId":"writer","changedAt":"2026-10-21T09:00:00Z","scopes":["theme-tokens"]}
                        """.trimIndent(),
                    )
                    statement.execute()
                }
            }
            connection.commit()
        }
    }

    private suspend fun verifyReconnect(database: IsolatedPostgresDatabase, backend: Int, signals: Channel<Long>) {
        connect(database).use { connection ->
            connection.prepareStatement("SELECT pg_terminate_backend(?)").use { statement ->
                statement.setInt(1, backend)
                statement.executeQuery().use { rows ->
                    rows.next()
                    assertTrue(rows.getBoolean(1))
                }
            }
        }
        withTimeout(10_000) {
            // Сигналы переполнения могут ещё находиться в очереди; повторный LISTEN имеет поколение 2.
            while (signals.receive() != 2L) Unit
        }
    }

    private fun connect(database: IsolatedPostgresDatabase) =
        DriverManager.getConnection(database.jdbcUrl, database.username, database.password)
}
