package com.dsbuilder.feature.publisher.data

import com.dsbuilder.feature.publisher.application.TransactionManager
import com.dsbuilder.feature.publisher.application.port.JobDispatcher
import com.dsbuilder.feature.publisher.application.port.JobLocalSource
import com.dsbuilder.feature.publisher.application.port.JobRunner.JobResult
import com.dsbuilder.feature.publisher.domain.entity.JobStatus
import com.dsbuilder.feature.publisher.domain.entity.JobStatusCode
import com.dsbuilder.feature.publisher.domain.entity.PublishJob
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import java.util.*
import java.util.concurrent.ConcurrentHashMap

/**
 * Dispatches PublishJob to JobRunner with bounded parallelism.
 * - Keeps up to [maxParallel] active JobRunner at a time.
 * - New jobs are queued (FIFO) and started when a slot becomes available.
 * - `cancel(job)` cancels a running job (via JobRunner.cancel()) or prevents a queued job from starting.
 */
internal class JobDispatcherImpl(
    private val jobLocalSource: JobLocalSource,
    private val tx: TransactionManager,
    private val dispatcher: CoroutineDispatcher = Dispatchers.Default,
    private val maxParallel: Int = 10,
) : JobDispatcher {

    private val queue = Channel<PublishJob>(Channel.UNLIMITED)
    private val semaphore = Semaphore(maxParallel)

    // Running JobRunners by job id
    private val running = ConcurrentHashMap<UUID, DooDJobRunner>()

    // Jobs cancelled before start — they will be skipped if still in queue
    private val cancelledPending = ConcurrentHashMap.newKeySet<UUID>()

    // Supervisor for launched coroutines
    private val launched = ConcurrentHashMap<UUID, Job>()

    @Volatile
    private var started: Boolean = false
    private var consumerJob: Job? = null

    override suspend fun start() = coroutineScope {
        if (started) return@coroutineScope
        started = true
        consumerJob = launch(dispatcher) {
            restoreQueue()
            for (job in queue) {
                val jobId = job.id
                if (cancelledPending.remove(jobId)) continue


                semaphore.withPermit {
                    tx.required { jobLocalSource.updateStatus(jobId, JobStatus.Running) }
                    val startJob = launch(dispatcher) {
                        val runner = job.runner()
                        running[jobId] = runner
                        try {
                            val result = runner.run()
                            val status = when (result) {
                                is JobResult.Fail -> JobStatus.Failed(result.exitCode, result.message)
                                is JobResult.Success -> JobStatus.Succeeded(result.artifacts)
                            }
                            tx.required { jobLocalSource.updateStatus(jobId, status) }
                        } finally {
                            running.remove(jobId)
                            launched.remove(jobId)
                        }
                    }
                    launched[jobId] = startJob
                }
            }
        }
    }

    override val isEmpty: Boolean
        get() = running.isEmpty() && queue.isEmpty

    override fun getStatus(jobId: UUID): JobStatus {
        return when {
            cancelledPending.contains(jobId) -> JobStatus.Canceled
            running.containsKey(jobId) -> JobStatus.Running
            else -> JobStatus.Queued
        }
    }

    override fun getLogs(jobId: UUID): Flow<String> {
        return running[jobId]?.logs ?: emptyFlow()
    }

    override suspend fun enqueue(job: PublishJob): Boolean {
        // If already cancelled, do not enqueue
        if (cancelledPending.contains(job.id)) return false
        tx.required { jobLocalSource.updateStatus(job.id, JobStatus.Queued) }
        queue.send(job)
        return true
    }

    override suspend fun cancel(id: UUID): Boolean {
        return cancelInternal(id) {
            tx.required { jobLocalSource.updateStatus(id, JobStatus.Canceled) }
        }
    }

    override suspend fun cancel(vararg ids: UUID): Boolean {
        val canceled = ids.filter { id -> cancelInternal(id) }
        if (canceled.isEmpty()) return false
        return tx.required {
            jobLocalSource.updateStatus(canceled.toSet(), JobStatus.Canceled)
        }
    }

    override suspend fun stop(cancelRunning: Boolean) {
        consumerJob?.cancel()
        consumerJob = null
        started = false
        if (cancelRunning) {
            running.values.forEach { runCatching { it.cancel() } }
        }
        launched.values.forEach { it.cancel() }
        running.clear()
        launched.clear()
    }

    private suspend fun restoreQueue() = runCatching {
        val restoredQueue = tx.required {
            val queue = jobLocalSource.getAll(setOf(JobStatusCode.QUEUED, JobStatusCode.RUNNING))
            if (queue.isNotEmpty()) {
                jobLocalSource.updateStatus(queue.map { it.id }.toSet(), JobStatus.Queued)
            }
            queue
        }

        for (job in restoredQueue) {
            if (!cancelledPending.contains(job.id)) {
                queue.send(job)
            }
        }
    }

    private suspend fun cancelInternal(id: UUID, applyStatus: suspend (UUID) -> Unit = {}): Boolean {
        // If running — cancel underlying runner (best-effort)
        running[id]?.let { runner ->
            return try {
                val result = runner.cancel()
                if (result) {
                    applyStatus(id)
                }
                result
            } catch (_: Exception) {
                false
            }
        }
        // Otherwise mark as cancelled so the consumer skips it when dequeued
        cancelledPending.add(id)
        applyStatus(id)

        // Also cancel a launcher if somehow already created but not started
        launched[id]?.cancel()
        return true
    }


    private companion object {

        fun PublishJob.runner(): DooDJobRunner {
            return DooDJobRunner(
                id = id,
                params = params,
            )
        }
    }
}