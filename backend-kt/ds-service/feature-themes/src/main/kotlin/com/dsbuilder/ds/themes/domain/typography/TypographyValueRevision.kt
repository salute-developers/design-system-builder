package com.dsbuilder.ds.themes.domain.typography

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import java.util.UUID

/** Техническая редакция значения токена темы на платформе: базовая редакция следующей записи клиента. */
data class TypographyValueRevision(
    /** Платформа значения. */
    val platform: ThemeTokenPlatform,
    /** Устойчивый идентификатор значения в `token_values`. */
    val valueId: UUID,
    /** Техническая редакция значения на выбранной границе; `0`, если значение не менялось в черновике. */
    val revision: Long,
)
