package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.data.PostgresDatabasePool
import io.ktor.http.HttpStatusCode
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/** Minimal in-process metrics required to verify a ds-service cutover. */
class DsMetrics {
    private val httpResponses = ConcurrentHashMap<Int, AtomicLong>()
    private val requestDurationMillis = AtomicLong()
    private val requests = AtomicLong()
    private val rbacDenials = AtomicLong()
    private val ownershipMisses = AtomicLong()
    private val transactionFailures = AtomicLong()

    /** Records one completed HTTP request without retaining request data. */
    fun record(status: HttpStatusCode?, durationMillis: Long, outcome: String) {
        val code = status?.value ?: 500
        httpResponses.computeIfAbsent(code) { AtomicLong() }.incrementAndGet()
        requests.incrementAndGet()
        requestDurationMillis.addAndGet(durationMillis.coerceAtLeast(0))
        when (outcome) {
            "rbac_denied" -> rbacDenials.incrementAndGet()
            "ownership_or_missing" -> ownershipMisses.incrementAndGet()
            "transaction_failure" -> transactionFailures.incrementAndGet()
        }
    }

    /** Renders the bounded metric set in Prometheus text format. */
    fun render(pool: PostgresDatabasePool): String = buildString {
        appendCounter("ds_http_requests_total", requests.get())
        httpResponses.toSortedMap().forEach { (status, value) ->
            append("ds_http_responses_total{status=\"").append(status).append("\"} ")
                .append(value.get()).append('\n')
        }
        appendCounter("ds_http_request_duration_milliseconds_total", requestDurationMillis.get())
        appendCounter("ds_rbac_denials_total", rbacDenials.get())
        appendCounter("ds_ownership_misses_total", ownershipMisses.get())
        appendCounter("ds_transaction_failures_total", transactionFailures.get())
        appendGauge("ds_db_pool_active", pool.activeConnections)
        appendGauge("ds_db_pool_idle", pool.idleConnections)
        appendGauge("ds_db_pool_pending", pool.pendingConnections)
        appendGauge("ds_db_pool_total", pool.totalConnections)
    }
}

private fun StringBuilder.appendCounter(name: String, value: Long) {
    append("# TYPE ").append(name).append(" counter\n")
    append(name).append(' ').append(value).append('\n')
}

private fun StringBuilder.appendGauge(name: String, value: Int) {
    append("# TYPE ").append(name).append(" gauge\n")
    append(name).append(' ').append(value).append('\n')
}
