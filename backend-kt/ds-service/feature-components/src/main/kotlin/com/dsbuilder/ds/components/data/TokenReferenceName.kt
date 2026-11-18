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

/**
 * Имена, под которыми импорт ищет токен ссылки: обратное к [referenceName] правило. Ссылка на стиль типографики без
 * экрана (`body.m.normal`) привязывается к токену `screen-s` того же начертания, если токена с точным именем нет;
 * ссылка с экраном и ссылки остальных типов ищутся по имени как есть.
 */
internal fun referenceCandidates(name: String, type: String?): List<String> =
    if (type == "typography" && !TYPOGRAPHY_SCREEN.containsMatchIn(name)) {
        listOf(
            name,
            "screen-s.$name",
        )
    } else {
        listOf(name)
    }

/** Ключевые слова CSS, которые значение свойства может содержать вместо ссылки на токен. */
private val LITERAL_KEYWORDS = setOf("transparent", "inherit", "initial", "unset", "currentcolor", "none")

/** Запись цвета CSS, которая значение свойства может содержать вместо ссылки на токен. */
private val LITERAL_COLOR_PREFIXES = listOf("#", "rgb(", "rgba(", "hsl(", "hsla(")

/**
 * Литерал CSS вместо ссылки на токен: `transparent`, `inherit`, `#F3A912`, `rgba(35, 35, 35, 0.2)`. Импорт проверяет
 * признак только для значения, токен которого не нашёлся: имя токена может быть и без точки (тень `card`).
 */
internal fun isLiteralValue(value: String): Boolean {
    val text = value.trim().lowercase()
    return text in LITERAL_KEYWORDS || LITERAL_COLOR_PREFIXES.any(text::startsWith)
}
