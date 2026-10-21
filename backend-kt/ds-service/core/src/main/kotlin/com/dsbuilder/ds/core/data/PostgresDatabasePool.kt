package com.dsbuilder.ds.core.data

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.sql.Connection

/**
 * Bounded PostgreSQL connection pool and its Exposed handle.
 *
 * @property database Exposed database bound to the owned Hikari pool
 */
class PostgresDatabasePool private constructor(
    private val dataSource: HikariDataSource,
    val database: Database,
) : AutoCloseable {
    private val ownedDatabases = mutableListOf(database)

    /** Number of connections currently borrowed from the pool. */
    val activeConnections: Int
        get() = dataSource.hikariPoolMXBean.activeConnections

    /** Number of idle connections currently retained by the pool. */
    val idleConnections: Int
        get() = dataSource.hikariPoolMXBean.idleConnections

    /** Number of callers currently waiting for a connection. */
    val pendingConnections: Int
        get() = dataSource.hikariPoolMXBean.threadsAwaitingConnection

    /** Total number of physical connections owned by the pool. */
    val totalConnections: Int
        get() = dataSource.hikariPoolMXBean.totalConnections

    @Synchronized
    override fun close() {
        try {
            dataSource.close()
        } finally {
            ownedDatabases.forEach(TransactionManager::closeAndUnregister)
            ownedDatabases.clear()
        }
    }

    @Synchronized
    internal fun ownDatabase(database: Database) {
        if (dataSource.isClosed) {
            TransactionManager.closeAndUnregister(database)
            error("PostgreSQL pool is closed")
        }
        ownedDatabases += database
    }

    internal fun borrowPublicationConnection(): Connection = dataSource.connection

    internal fun evictPublicationConnection(connection: Connection) = dataSource.evictConnection(connection)

    companion object {
        /** Creates a validated bounded PostgreSQL pool. */
        fun create(
            jdbcUrl: String,
            user: String,
            password: String,
            maximumPoolSize: Int,
            connectionTimeoutMs: Long,
        ): PostgresDatabasePool {
            require(maximumPoolSize > 0) { "Pool size must be positive" }
            val configuration = HikariConfig().apply {
                this.jdbcUrl = jdbcUrl
                username = user
                this.password = password
                driverClassName = "org.postgresql.Driver"
                this.maximumPoolSize = maximumPoolSize
                minimumIdle = 0
                this.connectionTimeout = connectionTimeoutMs
                poolName = "ds-service-postgres"
                isAutoCommit = false
            }
            val dataSource = HikariDataSource(configuration)
            return PostgresDatabasePool(dataSource, Database.connect(dataSource))
        }
    }
}
