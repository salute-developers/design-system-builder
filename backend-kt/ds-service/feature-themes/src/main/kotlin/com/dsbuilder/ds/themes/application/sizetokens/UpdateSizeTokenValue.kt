package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueInput

/** Замена значения токена размеров в текущей теме. */
data class UpdateSizeTokenValue(
    /** Новое значение в виде запроса; проверяется по типу токена. */
    val value: SizeValueInput,
    /**
     * Базовые технические редакции значений по платформам из чтения значений темы; платформа без ключа берёт
     * базовую редакцию из заголовка `X-DS-Base-Revision`.
     */
    val baseRevisions: Map<ThemeTokenPlatform, Long> = emptyMap(),
)
