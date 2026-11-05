package com.dsbuilder.ds.components.data

/** Экран в начале имени токена типографики: `screen-s.`. */
private val TYPOGRAPHY_SCREEN = Regex("""^screen-[sml]\.""")

/**
 * Имя, которым ссылка по `token_id` показывается вместо текста значения свойства. Компоненты ссылаются на стиль
 * типографики без экрана (`body.m.normal`), а по `token_id` — на токен экрана `screen-s` того же начертания, поэтому у
 * токена типографики экран отбрасывается; у остальных токенов — имя как есть.
 */
internal fun referenceName(name: String?, type: String?): String? =
    if (name != null && type == "typography") name.replaceFirst(TYPOGRAPHY_SCREEN, "") else name
