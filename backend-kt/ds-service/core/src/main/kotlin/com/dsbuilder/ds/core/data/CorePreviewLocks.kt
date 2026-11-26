package com.dsbuilder.ds.core.data

import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Один namespace для регистрации preview и раннего барьера публикации выбранного Core. */
object CorePreviewLocks {
    /** Отдельный от блокировок ДС ключ; независимые Core не блокируют друг друга. */
    const val NAMESPACE = 684314L

    /** Выбор черновика защищает совместимую сборку до фиксации новой привязки. */
    fun lockSelection(releaseId: UUID) {
        TransactionManager.current().exec(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended(CAST(? AS text), $NAMESPACE))",
            listOf(UUIDColumnType() to releaseId),
        )
    }

    /** READ COMMITTED регистрация не пропускает ещё не зафиксированный исторический слот. */
    fun lockRegistration(releaseId: UUID) {
        TransactionManager.current().exec(
            "SELECT pg_advisory_xact_lock(hashtextextended(CAST(? AS text), $NAMESPACE))",
            listOf(UUIDColumnType() to releaseId),
        )
    }
}
