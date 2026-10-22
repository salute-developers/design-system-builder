package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.PublicationTransactionRunner
import com.dsbuilder.ds.core.application.TransactionFailureMapper
import kotlinx.coroutines.Job
import kotlinx.coroutines.asContextElement
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.job
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.core.DatabaseConfig
import org.jetbrains.exposed.v1.core.vendors.PostgreSQLDialect
import org.jetbrains.exposed.v1.jdbc.Database
import java.sql.Connection
import java.sql.SQLException
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/** Владеет барьером публикации от получения соединения до его безопасного возврата в пул. */
class ExposedPublicationTransactionRunner(
    private val pool: PostgresDatabasePool,
    failureMapper: TransactionFailureMapper,
) : PublicationTransactionRunner {
    private data class Request(val context: DsRequestContext, val designSystemId: UUID, val job: Job)
    private class Inaccessible : RuntimeException()

    private val request = ThreadLocal<Request>()
    private val database = Database.connect(
        getNewConnection = { acquire(requireNotNull(request.get())) },
        databaseConfig = DatabaseConfig {
            explicitDialect = PostgreSQLDialect()
            defaultIsolationLevel = Connection.TRANSACTION_SERIALIZABLE
        },
    ).also(pool::ownDatabase)
    private val transactions = ExposedTransactionRunner(database, failureMapper)

    override suspend fun <T> required(
        context: DsRequestContext,
        designSystemId: UUID,
        block: suspend () -> DsResult<T>,
    ): DsResult<T> = try {
        val publication = Request(context, designSystemId, currentCoroutineContext().job)
        withContext(request.asContextElement(publication)) {
            transactions.required(context, block)
        }
    } catch (_: Inaccessible) {
        DsResult.Failure(DsFailure.NotFound)
    }

    @Suppress("TooGenericExceptionCaught") // Любая неопределённость до возврата обёртки уничтожает физический сеанс.
    private fun acquire(publication: Request): Connection {
        val connection = pool.borrowPublicationConnection()
        try {
            if (!connection.autoCommit) connection.rollback()
            connection.autoCommit = true
            requireAccessible(connection, publication)
            awaitLock(connection, publication)
            return PublicationConnection(connection, publication.designSystemId, pool)
        } catch (failure: Throwable) {
            // Hikari eviction уже закрывает заимствованный физический сеанс; повторный close proxy небезопасен.
            pool.evictPublicationConnection(connection)
            throw failure
        }
    }

    private fun requireAccessible(connection: Connection, publication: Request) {
        val accessible = connection.prepareStatement(
            "SELECT 1 FROM design_systems WHERE id = ? AND project_id = ?",
        ).use {
            it.queryTimeout = QUERY_TIMEOUT_SECONDS
            it.setObject(1, publication.designSystemId)
            it.setString(2, publication.context.projectId.value)
            it.executeQuery().use { rows -> rows.next() }
        }
        if (!accessible) throw Inaccessible()
    }

    private fun awaitLock(connection: Connection, publication: Request) {
        val deadline = System.nanoTime() + LOCK_TIMEOUT_NANOS
        while (true) {
            publication.job.ensureActive()
            if (System.nanoTime() >= deadline) throw SQLException("Publication lock timed out", "55P03")
            if (lockQuery(connection, "pg_try_advisory_lock", publication.designSystemId)) return
            Thread.sleep(POLL_MILLIS)
        }
    }

    private class PublicationConnection(
        private val raw: Connection,
        private val designSystemId: UUID,
        private val pool: PostgresDatabasePool,
    ) : Connection by raw {
        private val closed = AtomicBoolean()
        private var uncertain = false

        override fun commit() {
            try {
                raw.commit()
            } catch (failure: SQLException) {
                uncertain = true
                throw failure
            }
        }

        override fun rollback() {
            try {
                raw.rollback()
            } catch (failure: SQLException) {
                uncertain = true
                throw failure
            }
        }

        override fun close() {
            if (!closed.compareAndSet(false, true)) return
            var released = false
            try {
                if (!uncertain) {
                    if (!raw.autoCommit) raw.rollback()
                    raw.autoCommit = true
                    released = lockQuery(raw, "pg_advisory_unlock", designSystemId)
                }
            } finally {
                if (!released) pool.evictPublicationConnection(raw) else raw.close()
            }
        }
    }

    private companion object {
        const val QUERY_TIMEOUT_SECONDS = 2
        const val LOCK_TIMEOUT_NANOS = 10_000_000_000L
        const val POLL_MILLIS = 25L

        fun lockQuery(connection: Connection, function: String, id: UUID): Boolean = connection.prepareStatement(
            "SELECT $function(hashtextextended(CAST(? AS text), 684313))",
        ).use { statement ->
            statement.queryTimeout = QUERY_TIMEOUT_SECONDS
            statement.setObject(1, id)
            statement.executeQuery().use { rows -> rows.next() && rows.getBoolean(1) }
        }
    }
}
