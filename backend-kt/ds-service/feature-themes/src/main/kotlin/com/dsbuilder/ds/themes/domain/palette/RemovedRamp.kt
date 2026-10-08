package com.dsbuilder.ds.themes.domain.palette

/** Итог удаления растяжки: число переназначенных связей и переписывание ссылок. */
data class RemovedRamp(
    /** Число связей, которые переписаны. */
    val reassigned: Int,
    /** Переписывание ссылок токенов или `null`, если связей не было. */
    val rewrite: TokenReferenceRewrite?,
)
