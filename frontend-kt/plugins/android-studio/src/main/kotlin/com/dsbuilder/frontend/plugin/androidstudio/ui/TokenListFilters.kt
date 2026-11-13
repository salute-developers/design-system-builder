package com.dsbuilder.frontend.plugin.androidstudio.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenType
import com.dsbuilder.frontend.plugin.androidstudio.tokens.TokenWithValue

/**
 * Значение токена зависит от режима темы только у цветов и градиентов; у остальных типов
 * (`typography`, `spacing`, `shape`, `shadow`) значение одно на обе темы, и выбор режима для них бессмыслен.
 */
internal fun TokenType?.isThemeDependent(): Boolean = this == TokenType.COLOR || this == TokenType.GRADIENT

/** Класс экрана токена типографики — первый сегмент имени вида `screen-l.body.m.normal`; иначе `null`. */
internal fun TokenWithValue.screenClass(): String? =
    token.name.substringBefore('.', missingDelimiterValue = "").takeIf { it.startsWith("screen-") }

/** Группы по классу экрана в порядке первого появления; токены без класса — одной группой без заголовка в конце. */
internal fun groupByScreenClass(tokens: List<TokenWithValue>): List<Pair<String?, List<TokenWithValue>>> {
    val grouped = tokens.groupBy { it.screenClass() }
    val withClass = grouped.filterKeys { it != null }.map { (key, value) -> key to value }
    return withClass + listOfNotNull(grouped[null]?.let { null to it })
}

/**
 * Убирает из названия префикс класса экрана. Имя токена — `screen-s.display.l`, а отображаемое имя
 * бывает и в camelCase (`screenSDisplayL`), и через разделитель (`screen-s.display.l`); срезается
 * `screen`/`screen-` + класс без учёта регистра, остаток начинается с маленькой буквы (`displayL`).
 */
internal fun String.withoutScreenClass(screenClass: String?): String {
    if (screenClass == null) return this
    val prefix =
        Regex(
            "^" + Regex.escape("screen") + "[-_. ]?" + Regex.escape(screenClass.removePrefix("screen-")) + "[-_. ]?",
            RegexOption.IGNORE_CASE,
        )
    val rest = replaceFirst(prefix, "")
    return if (rest.isEmpty() || rest == this) this else rest.replaceFirstChar { it.lowercaseChar() }
}

/** Заголовок группы: `screen S`. */
internal fun screenClassTitle(screenClass: String): String = "screen ${screenClass.removePrefix("screen-").uppercase()}"

/** Фиксированный порядок вкладок — не зависит от того, в каком порядке типы пришли в конкретной дизайн-системе. */
private val TAB_TYPE_ORDER = listOf(
    TokenType.COLOR,
    TokenType.GRADIENT,
    TokenType.TYPOGRAPHY,
    TokenType.SHADOW,
    TokenType.SHAPE,
    TokenType.SPACING,
)

/** Уникальные типы в порядке [TAB_TYPE_ORDER]; неизвестный тип (`null`, вкладка «Другое») — последним. */
internal fun orderedTokenTypes(types: List<TokenType?>): List<TokenType?> =
    types.distinct().sortedBy { type -> TAB_TYPE_ORDER.indexOf(type).takeIf { it >= 0 } ?: Int.MAX_VALUE }

/** Название токена так, как оно показано в строке списка (без префикса класса экрана). */
internal fun TokenWithValue.visibleTitle(): String =
    (token.displayName ?: token.name).withoutScreenClass(screenClass())

/**
 * Поиск по видимому названию: остаются токены, содержащие [query] (без учёта регистра), а начинающиеся
 * с него идут первыми — «лучшее совпадение» оказывается вверху. Порядок внутри каждой группы сохраняется.
 * Пустой запрос возвращает список как есть.
 */
internal fun searchTokens(tokens: List<TokenWithValue>, query: String): List<TokenWithValue> {
    val needle = query.trim()
    if (needle.isEmpty()) return tokens
    val (prefixMatches, others) = tokens
        .filter { it.visibleTitle().contains(needle, ignoreCase = true) }
        .partition { it.visibleTitle().startsWith(needle, ignoreCase = true) }
    return prefixMatches + others
}
