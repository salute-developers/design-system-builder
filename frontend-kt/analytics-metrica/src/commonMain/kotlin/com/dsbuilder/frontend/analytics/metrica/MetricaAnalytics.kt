package com.dsbuilder.frontend.analytics.metrica

import com.dsbuilder.frontend.core.analytics.Analytics
import com.dsbuilder.frontend.core.analytics.AnalyticsContext
import com.dsbuilder.frontend.core.analytics.AnalyticsEvent
import com.dsbuilder.frontend.core.analytics.AnalyticsFlushResult
import com.dsbuilder.frontend.core.analytics.AnalyticsValue
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ClosedSendChannelException
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Создаёт прямой адаптер с ограниченной очередью и передаваемыми часами для тестирования. */
public fun createMetricaAnalytics(
    config: MetricaConfig,
    context: AnalyticsContext,
    identities: MetricaIdentityStore,
    transport: MetricaTransport,
    nowEpochSeconds: () -> Long,
): Analytics = MetricaAnalytics(config, context, identities, transport, nowEpochSeconds)

private sealed interface DeliveryItem {
    class Event(val event: AnalyticsEvent) : DeliveryItem
    class Barrier(val done: CompletableDeferred<Unit>) : DeliveryItem
}

private class MetricaAnalytics(
    private val config: MetricaConfig,
    private val context: AnalyticsContext,
    private val identities: MetricaIdentityStore,
    private val transport: MetricaTransport,
    private val now: () -> Long,
) : Analytics {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val queue = Channel<DeliveryItem>(128)
    private val clientId = scope.async(start = CoroutineStart.LAZY) {
        metricaAttempt {
            identities.getOrCreateInstallationId().also { id -> require(id.toLongOrNull()?.let { it > 0 } == true) }
        }
    }
    private val pages = metricaPageCatalog(context.clientType, config.operations)

    init {
        scope.launch {
            for (item in queue) {
                when (item) {
                    is DeliveryItem.Barrier -> item.done.complete(Unit)
                    is DeliveryItem.Event -> metricaAttempt { deliver(item.event) }
                }
            }
        }
    }

    override fun track(event: AnalyticsEvent) {
        queue.trySend(DeliveryItem.Event(event))
    }

    override suspend fun flush(timeoutMillis: Long): AnalyticsFlushResult {
        val done = CompletableDeferred<Unit>()
        val completed = withTimeoutOrNull(timeoutMillis.coerceAtLeast(1)) {
            try {
                queue.send(DeliveryItem.Barrier(done))
                done.await()
            } catch (_: ClosedSendChannelException) { /* Уже закрыто. */ }
            true
        } ?: false
        return if (completed) AnalyticsFlushResult.COMPLETED else AnalyticsFlushResult.TIMED_OUT
    }

    override fun close() {
        if (queue.close()) {
            scope.cancel()
            transport.close()
        }
    }

    private suspend fun deliver(event: AnalyticsEvent) {
        val page = page(event) ?: return
        val cid = clientId.await() ?: return
        val fields = mapOf(
            "tid" to config.counterId,
            "ms" to config.token,
            "cid" to cid,
            "et" to event.occurredAtEpochSeconds.toString(),
            "t" to "pageview",
            "dl" to "${config.baseUrl.trimEnd('/')}$page",
            "dt" to "DS Builder ${context.clientType}",
            "params" to JsonObject(context.visitProperties().mapValues { JsonPrimitive(it.value) }).toString(),
        )
        withTimeoutOrNull(1000) { transport.send(MetricaRequest(fields)) }
    }

    private fun page(event: AnalyticsEvent): String? {
        if (now() - event.occurredAtEpochSeconds !in 0..43_200) return null
        val operation = (event.properties["operation"] as? AnalyticsValue.Text)?.value
        val outcome = (event.properties["outcome"] as? AnalyticsValue.Text)?.value
        return pages[Triple(event.name, operation, outcome)]
    }
}

/** Одна политика изоляции ошибок доставки и идентификации; отмена всегда остаётся отменой. */
@Suppress("TooGenericExceptionCaught")
private suspend fun <T> metricaAttempt(block: suspend () -> T): T? = try {
    block()
} catch (cancelled: CancellationException) {
    throw cancelled
} catch (_: Exception) {
    null
}
