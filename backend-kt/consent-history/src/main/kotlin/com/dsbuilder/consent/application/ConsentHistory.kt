package com.dsbuilder.consent.application

import com.dsbuilder.consent.domain.ConsentInput
import com.dsbuilder.consent.domain.ConsentPolicy
import com.dsbuilder.consent.domain.ConsentScope

/** Чтение собственного решения и регистрация явного выбора. */
class ConsentHistory(private val store: ConsentHistoryStore, private val policies: Map<String, ConsentPolicy>) {
    /** Возвращает действующее уведомление группы. */
    fun policy(group: String): ConsentPolicy = requireNotNull(policies[group])

    /** Читает последнее решение собственной области. */
    suspend fun current(scope: ConsentScope) = store.current(scope)

    /** Регистрирует решение и возвращает квитанцию после фиксации. */
    suspend fun record(
        scope: ConsentScope,
        input: ConsentInput,
    ) = store.append(
        scope,
        input,
        policy(scope.clientGroup),
    )
}
