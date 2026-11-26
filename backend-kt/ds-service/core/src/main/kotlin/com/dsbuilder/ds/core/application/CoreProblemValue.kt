package com.dsbuilder.ds.core.application

import java.util.UUID

/** Сохранённое значение без обещания восстановить вычисления прошлого Core. */
data class CoreProblemValue(
    /** Исходный литерал без фильтрации несовместимых данных. */
    val literal: String?,
    /** ID назначенного токена. */
    val tokenId: UUID?,
    /** Диагностическое имя назначенного токена. */
    val tokenName: String?,
    /** Сохранённая прозрачность. */
    val alpha: String?,
    /** Сохранённая общая поправка значения. */
    val adjustment: String?,
    /** ID явно выбранного вложенного оформления. */
    val targetAppearanceId: UUID?,
    /** Стили вложенного оформления, выбранные в настройках ДС. */
    val targetStyleIds: List<UUID>,
    /** Отдельные платформенные поправки, запрещающие автоматический перенос. */
    val platformAdjustments: List<CoreProblemAdjustment>,
)
