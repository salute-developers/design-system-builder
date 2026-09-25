package com.dsbuilder.documentation.processing.domain

import java.time.Duration
import java.time.Instant

/** Политика безопасной очистки заменённых публикаций. */
data class PublicationCleanupPolicy(
    /** Защитная задержка перед первым захватом. */ val gracePeriod: Duration,
    /** Срок аренды одной попытки. */ val leaseDuration: Duration,
    /** Начальная задержка повтора. */ val retryInitialDelay: Duration,
    /** Максимальная задержка повтора. */ val retryMaxDelay: Duration,
) {
    init {
        requirePositive(gracePeriod, "gracePeriod")
        requirePositive(leaseDuration, "leaseDuration")
        requirePositive(retryInitialDelay, "retryInitialDelay")
        requirePositive(retryMaxDelay, "retryMaxDelay")
        require(retryInitialDelay <= retryMaxDelay) { "retryInitialDelay must not exceed retryMaxDelay" }
    }

    private fun requirePositive(value: Duration, name: String) {
        require(!value.isZero && !value.isNegative) { "$name must be positive" }
    }
}

/** Захваченное задание с fencing-данными аренды. */
data class PublicationCleanupClaim(
    /** Идентификатор заменённой публикации. */ val publicationId: String,
    /** Владелец аренды. */ val leaseOwner: String,
    /** Граница срока аренды. */ val leaseUntil: Instant,
    /** Номер начатой попытки. */ val attempt: Int,
)

/** Точное описание сохранённого объекта. */
data class StoredObjectDescriptor(
    /** Bucket объекта. */ val bucket: String,
    /** Полный ключ объекта. */ val key: String,
    /** Сохранённый размер объекта. */ val size: Long,
)

/** Проверенная цель одной попытки очистки. */
data class PublicationCleanupTarget(
    /** Захваченное задание. */ val claim: PublicationCleanupClaim,
    /** Объекты неизменяемого снимка. */ val publicationObjects: List<StoredObjectDescriptor>,
    /** Исходный загруженный пакет. */ val rawBundle: StoredObjectDescriptor,
)

/** Итог удаления объектов. */
data class DeletedObjects(
    /** Число идемпотентно обработанных объектов. */ val count: Int,
    /** Суммарный сохранённый размер объектов. */ val bytes: Long,
)

/** Низкокардинальный исход попытки. */
enum class PublicationCleanupOutcome { SUCCEEDED, RETRY_SCHEDULED, BLOCKED, LEASE_LOST }

/** Безопасный класс отказа без инфраструктурных деталей. */
enum class PublicationCleanupFailureClass { OBJECT_STORAGE, DATABASE, INVARIANT }

/** Низкокардинальное наблюдение одной попытки очистки. */
data class PublicationLifecycleObservation(
    /** Исход попытки. */ val outcome: PublicationCleanupOutcome,
    /** Класс отказа либо `null` при успехе. */ val failureClass: PublicationCleanupFailureClass?,
    /** Длительность попытки. */ val durationMillis: Long,
    /** Объём идемпотентно удалённых данных. */ val deletedBytes: Long,
)

/** Результат одного ограниченного шага фоновой очистки. */
sealed interface PublicationCleanupRunResult {
    /** Готовая работа отсутствует. */
    data object NoWork : PublicationCleanupRunResult

    /** Очистка успешно завершена. */
    data class Succeeded(
        /** Агрегированный результат удаления объектов. */ val deleted: DeletedObjects,
    ) : PublicationCleanupRunResult

    /** Повтор устойчиво запланирован. */
    data class RetryScheduled(
        /** Безопасный класс временного отказа. */ val failureClass: PublicationCleanupFailureClass,
        /** Момент готовности следующей попытки. */ val nextAttemptAt: Instant,
    ) : PublicationCleanupRunResult

    /** Задание заблокировано из-за нарушения инварианта. */
    data class Blocked(
        /** Безопасный класс причины блокировки. */ val failureClass: PublicationCleanupFailureClass,
    ) : PublicationCleanupRunResult

    /** Аренда потеряна до завершающей записи. */
    data object LeaseLost : PublicationCleanupRunResult
}

/** Агрегированная диагностика устойчивой очереди очистки. */
data class PublicationCleanupQueueDiagnostics(
    /** Число незавершённых заданий. */ val queueSize: Long,
    /** Возраст самого старого готового задания. */ val oldestReadyAgeSeconds: Long,
    /** Число заданий с истёкшей арендой. */ val expiredLeases: Long,
)
