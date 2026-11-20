package com.dsbuilder.ds.core.application

/** Результат специализации; предметные отказы до мутации уточняет общий алгоритм. */
enum class DraftValueBatchOutcome {
    NOT_APPLICABLE,
    REVERTED,
    DEPENDENCY_CONFLICT,
}
