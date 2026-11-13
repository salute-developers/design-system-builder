package com.dsbuilder.ds.core.application

import java.util.UUID

/** Отдельная платформенная поправка, которую нельзя потерять при исправлении. */
data class CoreProblemAdjustment(
    /** Устойчивый ID платформенной поправки. */
    val id: UUID,
    /** ID параметра платформы, к которому относится поправка. */
    val platformParamId: UUID,
    /** Предметная ревизия для optimistic concurrency; null для исходного значения. */
    val revision: Long?,
    /** Сохранённое смещение или литерал поправки. */
    val value: String?,
    /** Сохранённый шаблон поправки. */
    val template: String?,
)
