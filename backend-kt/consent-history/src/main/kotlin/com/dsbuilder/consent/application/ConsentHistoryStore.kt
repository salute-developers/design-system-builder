package com.dsbuilder.consent.application

import com.dsbuilder.consent.domain.ConsentInput
import com.dsbuilder.consent.domain.ConsentPolicy
import com.dsbuilder.consent.domain.ConsentReceipt
import com.dsbuilder.consent.domain.ConsentRecord
import com.dsbuilder.consent.domain.ConsentScope

/** Две операции журнала; реализация обеспечивает атомарность в БД. */
interface ConsentHistoryStore {
    /** Читает последнюю серверную ревизию либо пустое состояние. */
    suspend fun current(scope: ConsentScope): ConsentReceipt?

    /** Атомарно сохраняет действие либо возвращает его прежнюю квитанцию. */
    suspend fun append(scope: ConsentScope, input: ConsentInput, policy: ConsentPolicy): ConsentRecord
}
