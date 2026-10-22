package com.dsbuilder.ds.core.application

import kotlinx.coroutines.flow.Flow

/** Поток подтверждённых изменений черновика, общий для всех HTTP-подписчиков экземпляра сервиса. */
interface DraftInvalidationStream {
    /** События, доставленные после фиксации соответствующей PostgreSQL-транзакции. */
    val events: Flow<DraftInvalidation>

    /** Сигнал восстановить курсоры после разрыва служебной PostgreSQL-подписки. */
    val reconnections: Flow<Long>
}
