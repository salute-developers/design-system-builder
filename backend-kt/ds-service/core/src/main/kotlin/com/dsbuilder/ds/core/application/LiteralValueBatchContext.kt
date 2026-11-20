package com.dsbuilder.ds.core.application

import java.util.UUID

/** Факты выбранных адресов и восстановленных семейств, полученные под блокировками до мутации. */
data class LiteralValueBatchContext(
    /** Доверенный владелец выбранных значений. */
    val designSystemId: UUID,
    /** Проверенный активный черновик. */
    val draftId: UUID,
    /** Снимки выбранных значений в порядке пакета. */
    val values: List<LiteralValueBatchValue>,
    /** Вычисленные состояния затронутых семейств. */
    val families: List<LiteralValueFamilyState>,
)
