package com.dsbuilder.ds.core.application

import java.util.UUID

/** Необязательная специализация полного отката значений; отказ от специализации предшествует мутациям. */
fun interface DraftValueBatchReverter {
    /** Выполняет пакет либо возвращает общий путь без предметных мутаций. */
    suspend fun revert(request: DraftValueBatchRequest): DraftValueBatchOutcome
}

/** Контекст пакета без типов хранилища и доверия к предметным адресам клиента. */
data class DraftValueBatchRequest(
    /** Владелец значений. */
    val designSystemId: UUID,
    /** Черновик, указанный адресной командой. */
    val draftId: UUID,
    /** Доверенный проект. */
    val projectId: String,
    /** Права системного администратора. */
    val systemAdmin: Boolean,
    /** Пары устойчивого ID значения и ожидаемой редакции в порядке запроса. */
    val targets: List<Pair<UUID, Long>>,
)

/** Результат специализации; предметные отказы до мутации уточняет общий алгоритм. */
enum class DraftValueBatchOutcome {
    NOT_APPLICABLE,
    REVERTED,
    DEPENDENCY_CONFLICT,
}
