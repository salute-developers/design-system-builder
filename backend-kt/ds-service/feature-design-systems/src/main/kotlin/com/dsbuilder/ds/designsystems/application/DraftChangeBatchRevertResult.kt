package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.designsystems.domain.DraftChangeRevertResult

/** Итог пакетного отката записей журнала: все записи отменены или отказ одной из них. */
sealed interface DraftChangeBatchRevertResult {
    /** Все записи пакета отменены. */
    data object Reverted : DraftChangeBatchRevertResult

    /**
     * Отказ [result] записи на позиции [index] пакета; `null` — отказ итогового состояния пакета, которое не
     * относится к одной записи (ограничения базы).
     */
    data class Failed(val index: Int?, val result: DraftChangeRevertResult) : DraftChangeBatchRevertResult
}
