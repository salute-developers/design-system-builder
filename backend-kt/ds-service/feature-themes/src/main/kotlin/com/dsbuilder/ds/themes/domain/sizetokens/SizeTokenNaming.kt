package com.dsbuilder.ds.themes.domain.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenType

/**
 * Правила имён токенов размеров. Токен с именем вне правила своего типа в разделе не показывается и операциями
 * не меняется.
 */
object SizeTokenNaming {
    /** Радиус «полного скругления»: показывается, но его значение не правится. */
    const val FULL_ROUNDING = "round.circle"

    private const val RADIUS_PREFIX = "round"
    private const val SPACING_PREFIX = "spacing"
    private const val SEGMENT = "[a-z0-9]+(?:-[a-z0-9]+)*"
    private val SEGMENT_RULE = Regex("^$SEGMENT$")
    private val RADIUS_RULE = Regex("""^$RADIUS_PREFIX\.$SEGMENT$""")
    private val SPACING_RULE = Regex("""^$SPACING_PREFIX\.$SEGMENT$""")

    /** Тень — любое имя из сегментов через точку: `down.soft.m`, `card`, `elevated.focus`. */
    private val SHADOW_RULE = Regex("""^$SEGMENT(?:\.$SEGMENT)*$""")

    /** Раздел токена типа [type] с полным именем [name] или `null`, если имя вне правила своего типа. */
    fun kindOf(type: ThemeTokenType?, name: String): SizeTokenKind? = when (type) {
        ThemeTokenType.SHAPE -> SizeTokenKind.RADIUS.takeIf { RADIUS_RULE.matches(name) }
        ThemeTokenType.SPACING -> SizeTokenKind.SPACING.takeIf { SPACING_RULE.matches(name) }
        ThemeTokenType.SHADOW -> SizeTokenKind.SHADOW.takeIf { SHADOW_RULE.matches(name) }
        else -> null
    }

    /** Является ли радиус [name] полным скруглением. */
    fun isFullRounding(name: String): Boolean = name == FULL_ROUNDING

    /** Допустим ли последний сегмент имени нового токена: `a-z`, `0-9` и `-`. */
    fun validSegment(name: String): Boolean = SEGMENT_RULE.matches(name)

    /**
     * Допустимо ли имя [name] нового токена раздела [kind]: у радиуса и отступа — один сегмент после префикса, у
     * тени — сегменты через точку (`card`, `elevated.focus`).
     */
    fun validName(kind: SizeTokenKind, name: String): Boolean =
        if (kind == SizeTokenKind.SHADOW) SHADOW_RULE.matches(name) else validSegment(name)

    /**
     * Ключ имени переменной тени в пакете: генератор заменяет точки дефисами, поэтому `down.soft.m` и `down-soft-m`
     * дают одну переменную `--shadow-down-soft-m` и в одной дизайн-системе быть не могут.
     */
    fun variableKey(name: String): String = name.replace('.', '-')

    /** Полное имя нового токена с последним сегментом [name]: `round.<имя>`, `spacing.<имя>`, у тени — само имя. */
    fun fullName(kind: SizeTokenKind, name: String): String = when (kind) {
        SizeTokenKind.RADIUS -> "$RADIUS_PREFIX.$name"
        SizeTokenKind.SPACING -> "$SPACING_PREFIX.$name"
        SizeTokenKind.SHADOW -> name
    }

    /**
     * Отображаемое имя по правилу сида: сегменты в camelCase, `round.xxxl` → `roundXxxl`,
     * `down.soft.xl` → `downSoftXl`, `spacing.14x` → `spacing14x`.
     */
    fun displayName(fullName: String): String = fullName.split('.', '-')
        .filter(String::isNotEmpty)
        .mapIndexed { index, part -> if (index == 0) part else part.replaceFirstChar(Char::uppercaseChar) }
        .joinToString("")
}
