package com.dsbuilder.documentation.processing.application

import com.dsbuilder.documentation.processing.domain.DeletedObjects
import com.dsbuilder.documentation.processing.domain.PublicationCleanupClaim
import com.dsbuilder.documentation.processing.domain.PublicationCleanupFailureClass
import com.dsbuilder.documentation.processing.domain.PublicationCleanupPolicy
import com.dsbuilder.documentation.processing.domain.PublicationCleanupQueueDiagnostics
import com.dsbuilder.documentation.processing.domain.PublicationCleanupRunResult
import com.dsbuilder.documentation.processing.domain.PublicationCleanupTarget
import com.dsbuilder.documentation.processing.domain.PublicationLifecycleObservation
import com.dsbuilder.documentation.processing.domain.StoredObjectDescriptor
import java.time.Duration
import java.time.Instant

/** Port устойчивой очереди и транзакционных инвариантов очистки. */
interface PublicationCleanupRepository {
    /** Захватывает следующее готовое задание. */
    suspend fun claim(workerId: String, policy: PublicationCleanupPolicy): PublicationCleanupClaim?

    /** Продлевает аренду только для текущего владельца. */
    suspend fun heartbeat(claim: PublicationCleanupClaim, leaseDuration: Duration): Boolean

    /** Формирует точную цель, только если публикация всё ещё безопасна для очистки. */
    suspend fun target(claim: PublicationCleanupClaim): PublicationCleanupTarget?

    /** Планирует ограниченный повтор только для текущего владельца аренды. */
    suspend fun scheduleRetry(
        claim: PublicationCleanupClaim,
        failureClass: PublicationCleanupFailureClass,
        nextAttemptAt: Instant,
    ): Boolean

    /** Блокирует задание только для текущего владельца аренды. */
    suspend fun block(claim: PublicationCleanupClaim, reason: PublicationCleanupFailureClass): Boolean

    /** Завершает очистку после повторной проверки аренды и active pointer. */
    suspend fun complete(claim: PublicationCleanupClaim, deletedAt: Instant): Boolean

    /** Возвращает агрегированную внутреннюю диагностику очереди. */
    suspend fun diagnostics(): PublicationCleanupQueueDiagnostics
}

/** Port идемпотентного удаления точных объектов. */
fun interface PublicationObjectDeleter {
    /** Удаляет переданный точный список без операций по префиксу. */
    suspend fun delete(objects: List<StoredObjectDescriptor>): DeletedObjects
}

/** Port низкокардинальной наблюдаемости жизненного цикла. */
fun interface PublicationLifecycleMetrics {
    /** Записывает агрегированное наблюдение без идентификаторов. */
    fun record(observation: PublicationLifecycleObservation)
}

/** Port счётчика созданных заданий очистки. */
fun interface PublicationCleanupSchedulingMetrics {
    /** Увеличивает счётчик после фиксации планирования. */
    fun jobsCreated(count: Int)
}

/** Port структурированного журнала переходов без влияния на состояние задания. */
fun interface PublicationLifecycleEventLogger {
    /** Записывает идентификатор только в тело записи, а не в labels метрик. */
    fun record(publicationId: String, result: PublicationCleanupRunResult)
}

/** Входной порт одного ограниченного шага очистки. */
fun interface CleanupSupersededPublicationUseCase {
    /** Обрабатывает не более одного готового задания. */
    suspend fun processNext(workerId: String): com.dsbuilder.documentation.processing.domain.PublicationCleanupRunResult
}
