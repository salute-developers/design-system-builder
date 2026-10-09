package com.dsbuilder.ds.core.data

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.jetbrains.exposed.v1.jdbc.Database

/**
 * Bounded PostgreSQL connection pool and its Exposed handle.
 *
 * @property database Exposed database bound to the owned Hikari pool
 */
class PostgresDatabasePool private constructor(
    private val dataSource: HikariDataSource,
    val database: Database,
) : AutoCloseable {
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

    override fun close() = dataSource.close()

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
