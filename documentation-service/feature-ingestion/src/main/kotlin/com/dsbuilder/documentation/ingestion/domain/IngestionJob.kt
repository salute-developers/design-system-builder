package com.dsbuilder.documentation.ingestion.domain

import java.time.Instant

/** Статус задания ingestion pipeline. */
enum class IngestionStatus {
    /** Bundle принят и ожидает worker. */
    ACCEPTED,

    /** Выполняется глубокая валидация. */
    VALIDATING,

    /** Выполняется нормализация. */
    NORMALIZING,

    /** Формируются knowledge chunks. */
    CHUNKING,

    /** Формируются поисковые индексы. */
    INDEXING,

    /** Выполняется атомарная публикация. */
    PUBLISHING,

    /** Публикация успешно завершена. */
    PUBLISHED,

    /** Обработка завершилась ошибкой. */
    FAILED,
    ;

    /** Признак terminal состояния. */
    val isTerminal: Boolean get() = this == PUBLISHED || this == FAILED
}

/** Прогресс обработки ingestion job. */
data class IngestionProgress(
    /** Число завершённых стадий. */
    val completedSteps: Int,
    /** Общее число стадий. */
    val totalSteps: Int,
    /** Число обработанных элементов текущей стадии. */
    val processedItems: Long = 0,
    /** Общее число элементов текущей стадии, если известно. */
    val totalItems: Long? = null,
)

/** Безопасное описание terminal failure. */
data class IngestionFailure(
    /** Стабильный машинный код. */
    val code: String,
    /** Безопасное сообщение без внутренних путей и credentials. */
    val message: String,
    /** Допускает ли класс ошибки повторный attempt. */
    val retryable: Boolean,
)

/** Задание последующей обработки bundle. */
data class IngestionJob(
    /** Идентификатор задания. */
    val id: String,
    /** Идентификатор bundle. */
    val bundleId: String,
    /** Статус задания. */
    val status: IngestionStatus,
    /** Текущая стадия обработки. */
    val currentStep: IngestionStatus = status,
    /** Идентификатор candidate publication. */
    val publicationId: String? = null,
    /** Номер текущего attempt. */
    val attempt: Int = 0,
    /** Идентификатор worker, владеющего lease. */
    val workerId: String? = null,
    /** Момент окончания lease. */
    val leaseUntil: Instant? = null,
    /** Прогресс обработки. */
    val progress: IngestionProgress = IngestionProgress(0, 5),
    /** Terminal failure, если обработка неуспешна. */
    val failure: IngestionFailure? = null,
    /** Время создания. */
    val createdAt: Instant,
    /** Время начала первого attempt. */
    val startedAt: Instant? = null,
    /** Время последнего heartbeat. */
    val heartbeatAt: Instant? = null,
    /** Время последнего изменения состояния. */
    val updatedAt: Instant = createdAt,
    /** Время завершения terminal состояния. */
    val finishedAt: Instant? = null,
)
