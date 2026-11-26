package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.PublicationTransactionRunner
import com.dsbuilder.ds.core.application.TransactionFailureMapper
import com.dsbuilder.ds.core.application.valueOr
import kotlinx.coroutines.Job
import kotlinx.coroutines.asContextElement
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.job
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.core.DatabaseConfig
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.vendors.PostgreSQLDialect
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection
import java.sql.SQLException
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/** Владеет барьером публикации от получения соединения до его безопасного возврата в пул. */
class ExposedPublicationTransactionRunner(
    private val pool: PostgresDatabasePool,
    failureMapper: TransactionFailureMapper,
) : PublicationTransactionRunner {
    private data class Request(
        val context: DsRequestContext,
        val designSystemId: UUID,
        val job: Job,
        val checkAccessBeforeLock: Boolean,
    )
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
    private val preflightTransactions = ExposedTransactionRunner(pool.database, failureMapper)

    override suspend fun <T> required(
        context: DsRequestContext,
        designSystemId: UUID,
        block: suspend () -> DsResult<T>,
    ): DsResult<T> = locked(context, designSystemId, checkAccessBeforeLock = true, block)

    override suspend fun <T> required(
        context: DsRequestContext,
        designSystemId: UUID,
        beforeLock: suspend () -> DsResult<Unit>,
        block: suspend () -> DsResult<T>,
    ): DsResult<T> {
        if (context.designSystemId != null && context.designSystemId != designSystemId) {
            return DsResult.Failure(DsFailure.NotFound)
        }
        // Предварительный поиск повтора не ждёт барьер ДС и не меняет её состояние.
        val prepared = preflightTransactions.required(context.copy(designSystemId = null)) {
            beforeLock().valueOr { return@required it }
            if (ownedInCurrentTransaction(context, designSystemId)) {
                DsResult.Success(Unit)
            } else {
                DsResult.Failure(DsFailure.NotFound)
            }
        }
        prepared.valueOr { return it }
        return locked(context, designSystemId, checkAccessBeforeLock = false, block)
    }

    private fun ownedInCurrentTransaction(context: DsRequestContext, designSystemId: UUID): Boolean =
        TransactionManager.current().exec(
            ACCESS_SQL,
            listOf(UUIDColumnType() to designSystemId, TextColumnType() to context.projectId.value),
        ) { rows -> rows.next() } ?: false

    private suspend fun <T> locked(
        context: DsRequestContext,
        designSystemId: UUID,
        checkAccessBeforeLock: Boolean,
        block: suspend () -> DsResult<T>,
    ): DsResult<T> = try {
        if (context.designSystemId != null && context.designSystemId != designSystemId) throw Inaccessible()
        val publication = Request(context, designSystemId, currentCoroutineContext().job, checkAccessBeforeLock)
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
            if (publication.checkAccessBeforeLock) requireAccessible(connection, publication)
            awaitLock(publication) { lockQuery(connection, "pg_try_advisory_lock", publication.designSystemId) }
            val releases = selectedCoreReleases(connection, publication.designSystemId)
            releases.forEach { release ->
                awaitLock(publication) {
                    lockQuery(connection, "pg_try_advisory_lock_shared", release, CorePreviewLocks.NAMESPACE)
                }
            }
            return PublicationConnection(connection, publication.designSystemId, releases, pool)
        } catch (failure: Throwable) {
            // Hikari eviction уже закрывает заимствованный физический сеанс; повторный close proxy небезопасен.
            pool.evictPublicationConnection(connection)
            throw failure
        }
    }

    private fun requireAccessible(connection: Connection, publication: Request) {
        val accessible = connection.prepareStatement(
            ACCESS_SQL,
        ).use {
            it.queryTimeout = QUERY_TIMEOUT_SECONDS
            it.setObject(1, publication.designSystemId)
            it.setString(2, publication.context.projectId.value)
            it.executeQuery().use { rows -> rows.next() }
        }
        if (!accessible) throw Inaccessible()
    }

    private fun selectedCoreReleases(connection: Connection, system: UUID): List<UUID> = connection.prepareStatement(
        "SELECT binding.release_id FROM design_system_version_core_releases binding " +
            "JOIN design_system_versions boundary ON boundary.id = binding.version_id " +
            "WHERE boundary.design_system_id = ? AND boundary.status = 'draft' ORDER BY binding.release_id",
    ).use { statement ->
        statement.queryTimeout = QUERY_TIMEOUT_SECONDS
        statement.setObject(1, system)
        statement.executeQuery().use { rows ->
            buildList {
                while (rows.next()) add(
                    rows.getObject(1, UUID::class.java),
                )
            }
        }
    }

    private fun awaitLock(publication: Request, attempt: () -> Boolean) {
        val deadline = System.nanoTime() + LOCK_TIMEOUT_NANOS
        while (true) {
            publication.job.ensureActive()
            if (System.nanoTime() >= deadline) throw SQLException("Publication lock timed out", "55P03")
            if (attempt()) return
            Thread.sleep(POLL_MILLIS)
        }
    }

    private class PublicationConnection(
        private val raw: Connection,
        private val designSystemId: UUID,
        private val coreReleases: List<UUID>,
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
                    released = coreReleases.asReversed().all { release ->
                        lockQuery(raw, "pg_advisory_unlock_shared", release, CorePreviewLocks.NAMESPACE)
                    } && lockQuery(raw, "pg_advisory_unlock", designSystemId)
                }
            } finally {
                if (!released) pool.evictPublicationConnection(raw) else raw.close()
            }
        }
    }

    private companion object {
        const val ACCESS_SQL = "SELECT 1 FROM design_systems WHERE id = ? AND project_id = ?"
        const val QUERY_TIMEOUT_SECONDS = 2
        const val LOCK_TIMEOUT_NANOS = 10_000_000_000L
        const val POLL_MILLIS = 25L

        fun lockQuery(connection: Connection, function: String, id: UUID, namespace: Long = 684313L): Boolean =
            connection.prepareStatement(
                "SELECT $function(hashtextextended(CAST(? AS text), $namespace))",
            ).use { statement ->
                statement.queryTimeout = QUERY_TIMEOUT_SECONDS
                statement.setObject(1, id)
                statement.executeQuery().use { rows -> rows.next() && rows.getBoolean(1) }
            }
    }
}
