package com.dsbuilder.documentation.app

import com.dsbuilder.documentation.processing.application.ProcessDocumentationJobUseCase
import com.dsbuilder.documentation.processing.application.ProcessingRunResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.time.Instant
import java.util.concurrent.atomic.AtomicReference

/** Snapshot независимого health background documentation worker. */
@Serializable
data class DocumentationWorkerHealthSnapshot(
    /** Включён ли worker configuration. */ val enabled: Boolean,
    /** Запущен ли worker loop. */ val running: Boolean,
    /** Время последнего успешного claim cycle. */ val lastSuccessfulCycleAt: String?,
    /** Безопасное описание последней runtime ошибки. */ val lastFailure: String?,
) {
    /** Может ли worker выполнять claim/lease operations. */
    val healthy: Boolean get() = !enabled || running && lastFailure == null
}

/** Thread-safe health state background worker. */
class DocumentationWorkerHealth(private val enabled: Boolean) {
    private val state = AtomicReference(DocumentationWorkerHealthSnapshot(enabled, false, null, null))

    /** Текущий immutable snapshot. */
    fun snapshot(): DocumentationWorkerHealthSnapshot = state.get()

    internal fun started() = update { it.copy(running = true, lastFailure = null) }
    internal fun succeeded(at: Instant) = update { it.copy(lastSuccessfulCycleAt = at.toString(), lastFailure = null) }
    internal fun failed(
        failure: Throwable,
    ) = update { it.copy(lastFailure = failure::class.simpleName ?: "WorkerFailure") }
    internal fun stopped() = update { it.copy(running = false) }

    private fun update(transform: (DocumentationWorkerHealthSnapshot) -> DocumentationWorkerHealthSnapshot) {
        state.updateAndGet(transform)
    }
}

/** Запускает polling worker loop в application scope. */
@Suppress("TooGenericExceptionCaught")
fun CoroutineScope.launchDocumentationWorker(
    enabled: Boolean,
    pollingMs: Long,
    workerId: String,
    processor: ProcessDocumentationJobUseCase,
    health: DocumentationWorkerHealth,
    clock: () -> Instant = Instant::now,
): Job? {
    return launchDocumentationWorkers(
        enabled,
        1,
        pollingMs,
        workerId,
        processor::processNext,
        health,
        clock,
    ).singleOrNull()
}

/** Запускает ограниченное число исполнителей; каждый арендует следующее задание после предыдущего. */
// Граница фонового задания: фиксируем сбой и продолжаем очередь; отмена выбрасывается отдельно.
@Suppress("TooGenericExceptionCaught")
fun CoroutineScope.launchDocumentationWorkers(
    enabled: Boolean,
    parallelism: Int,
    pollingMs: Long,
    workerId: String,
    processNext: suspend (String) -> ProcessingRunResult,
    health: DocumentationWorkerHealth,
    clock: () -> Instant = Instant::now,
): List<Job> {
    require(parallelism in 1..32) { "DOCUMENTATION_WORKER_PARALLELISM must be in 1..32" }
    require(pollingMs > 0) { "DOCUMENTATION_WORKER_POLLING_MS must be positive" }
    if (!enabled) return emptyList()
    return (0 until parallelism).map { index ->
        launch(kotlinx.coroutines.Dispatchers.IO.limitedParallelism(32)) {
            health.started()
            try {
                while (isActive) {
                    try {
                        val result = processNext("$workerId-$index")
                        health.succeeded(clock())
                        if (result is ProcessingRunResult.Idle) delay(pollingMs)
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (failure: Exception) {
                        health.failed(failure)
                        delay(pollingMs)
                    }
                }
            } finally {
                health.stopped()
            }
        }
    }
}
