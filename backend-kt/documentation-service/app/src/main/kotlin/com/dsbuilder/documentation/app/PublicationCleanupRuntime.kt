@file:Suppress("MatchingDeclarationName")

package com.dsbuilder.documentation.app

import com.dsbuilder.documentation.processing.application.CleanupSupersededPublicationUseCase
import com.dsbuilder.documentation.processing.application.PublicationCleanupRepository
import com.dsbuilder.documentation.processing.application.PublicationCleanupSchedulingMetrics
import com.dsbuilder.documentation.processing.application.PublicationLifecycleEventLogger
import com.dsbuilder.documentation.processing.application.PublicationLifecycleMetrics
import com.dsbuilder.documentation.processing.domain.PublicationCleanupOutcome
import com.dsbuilder.documentation.processing.domain.PublicationCleanupQueueDiagnostics
import com.dsbuilder.documentation.processing.domain.PublicationCleanupRunResult
import com.dsbuilder.documentation.processing.domain.PublicationLifecycleObservation
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

/** Низкокардинальная telemetry фоновой очистки публикаций. */
class PublicationLifecycleTelemetry :
    PublicationLifecycleMetrics,
    PublicationLifecycleEventLogger,
    PublicationCleanupSchedulingMetrics {
    private val logger = LoggerFactory.getLogger(PublicationLifecycleTelemetry::class.java)
    private val created = AtomicLong()
    private val outcomes = ConcurrentHashMap<String, AtomicLong>()
    private val durationsMillis = AtomicLong()
    private val deletedBytes = AtomicLong()
    private val queue = AtomicReference(PublicationCleanupQueueDiagnostics(0, 0, 0))
    private val queueCollections = AtomicLong()
    private val queueCollectionFailures = AtomicLong()

    override fun jobsCreated(count: Int) {
        created.addAndGet(count.toLong())
        logger.info("publication_cleanup_jobs_created count={}", count)
    }

    override fun record(observation: PublicationLifecycleObservation) {
        val key = listOf(observation.outcome.name, observation.failureClass?.name ?: "none").joinToString(":")
        outcomes.computeIfAbsent(key) { AtomicLong() }.incrementAndGet()
        durationsMillis.addAndGet(observation.durationMillis)
        deletedBytes.addAndGet(observation.deletedBytes)
        logger.info(
            "publication_cleanup_attempt outcome={} failureClass={} durationMillis={} deletedBytes={}",
            observation.outcome.name,
            observation.failureClass?.name ?: "none",
            observation.durationMillis,
            observation.deletedBytes,
        )
    }

    override fun record(publicationId: String, result: PublicationCleanupRunResult) {
        val failureClass = when (result) {
            is PublicationCleanupRunResult.RetryScheduled -> result.failureClass.name
            is PublicationCleanupRunResult.Blocked -> result.failureClass.name
            else -> "none"
        }
        logger.info(
            "publication_cleanup_transition publicationId={} outcome={} failureClass={}",
            publicationId,
            result.outcomeName(),
            failureClass,
        )
    }

    /** Обновляет gauges очереди и пишет агрегированную диагностическую запись. */
    fun recordQueue(diagnostics: PublicationCleanupQueueDiagnostics) {
        queue.set(diagnostics)
        queueCollections.incrementAndGet()
        logger.info(
            "publication_cleanup_queue size={} oldestReadyAgeSeconds={} expiredLeases={}",
            diagnostics.queueSize,
            diagnostics.oldestReadyAgeSeconds,
            diagnostics.expiredLeases,
        )
    }

    /** Учитывает отказ обновления queue gauges без влияния на readiness. */
    fun recordQueueCollectionFailure() {
        queueCollectionFailures.incrementAndGet()
    }

    /** Возвращает экспортируемый snapshot внутренней диагностики. */
    fun snapshot(): PublicationCleanupDiagnosticsSnapshot {
        val queueSnapshot = queue.get()
        return PublicationCleanupDiagnosticsSnapshot(
            createdJobs = created.get(),
            attemptsByOutcomeAndFailure = outcomes.entries.associate { it.key to it.value.get() }.toSortedMap(),
            totalDurationMillis = durationsMillis.get(),
            deletedBytes = deletedBytes.get(),
            queueSize = queueSnapshot.queueSize,
            oldestReadyAgeSeconds = queueSnapshot.oldestReadyAgeSeconds,
            expiredLeases = queueSnapshot.expiredLeases,
            queueCollections = queueCollections.get(),
            queueCollectionFailures = queueCollectionFailures.get(),
        )
    }
}

/** Экспортируемые низкокардинальные метрики и gauges очистки. */
@Serializable
data class PublicationCleanupDiagnosticsSnapshot(
    /** Число созданных runtime-заданий. */ val createdJobs: Long,
    /** Счётчики попыток по ограниченным outcome/failure class. */ val attemptsByOutcomeAndFailure: Map<String, Long>,
    /** Суммарная длительность наблюдавшихся попыток. */ val totalDurationMillis: Long,
    /** Суммарный объём обработанных удалений. */ val deletedBytes: Long,
    /** Все незавершённые задания, включая blocked. */ val queueSize: Long,
    /** Возраст самого старого готового задания. */ val oldestReadyAgeSeconds: Long,
    /** Число истёкших аренд. */ val expiredLeases: Long,
    /** Число успешных обновлений queue gauges. */ val queueCollections: Long,
    /** Число отказов обновления queue gauges. */ val queueCollectionFailures: Long,
)

/** Сводная диагностика существующего внутреннего worker endpoint. */
@Serializable
data class DocumentationBackgroundWorkersDiagnostics(
    /** Состояние основного processing worker. */ val processing: DocumentationWorkerHealthSnapshot,
    /** Включено ли выполнение cleanup jobs; gauges собираются независимо. */ val cleanupEnabled: Boolean,
    /** Метрики и gauges очистки публикаций. */ val cleanup: PublicationCleanupDiagnosticsSnapshot,
)

/** Запускает независимый polling loop очистки заменённых публикаций. */
@Suppress("TooGenericExceptionCaught")
fun CoroutineScope.launchPublicationCleanupWorker(
    enabled: Boolean,
    pollingMs: Long,
    workerId: String,
    cleanup: CleanupSupersededPublicationUseCase,
    repository: PublicationCleanupRepository,
    telemetry: PublicationLifecycleTelemetry,
): Job {
    require(pollingMs > 0) { "cleanup pollingMs must be positive" }
    val logger = LoggerFactory.getLogger("PublicationCleanupWorker")
    return launch {
        while (isActive) {
            try {
                val result = runPublicationCleanupCycle(enabled, workerId, cleanup, repository, telemetry)
                if (result is PublicationCleanupRunResult.NoWork) delay(pollingMs)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                logger.warn("publication_cleanup_cycle_failed failureClass={}", failure::class.simpleName)
                delay(pollingMs)
            }
        }
    }
}

@Suppress("TooGenericExceptionCaught")
internal suspend fun runPublicationCleanupCycle(
    enabled: Boolean,
    workerId: String,
    cleanup: CleanupSupersededPublicationUseCase,
    repository: PublicationCleanupRepository,
    telemetry: PublicationLifecycleTelemetry,
): PublicationCleanupRunResult {
    val result = if (enabled) cleanup.processNext(workerId) else PublicationCleanupRunResult.NoWork
    val diagnostics = try {
        repository.diagnostics()
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (failure: Exception) {
        telemetry.recordQueueCollectionFailure()
        throw failure
    }
    telemetry.recordQueue(diagnostics)
    return result
}

private fun PublicationCleanupRunResult.outcomeName(): String = when (this) {
    is PublicationCleanupRunResult.Succeeded -> PublicationCleanupOutcome.SUCCEEDED.name
    is PublicationCleanupRunResult.RetryScheduled -> PublicationCleanupOutcome.RETRY_SCHEDULED.name
    is PublicationCleanupRunResult.Blocked -> PublicationCleanupOutcome.BLOCKED.name
    PublicationCleanupRunResult.LeaseLost -> PublicationCleanupOutcome.LEASE_LOST.name
    PublicationCleanupRunResult.NoWork -> "NO_WORK"
}
