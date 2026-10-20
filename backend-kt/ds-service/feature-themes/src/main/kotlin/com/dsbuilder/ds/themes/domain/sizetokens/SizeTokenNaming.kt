package com.dsbuilder.ds.themes.domain.sizetokens

import com.dsbuilder.ds.themes.domain.ThemeTokenType

/**
 * Правила имён токенов размеров. Токен с именем вне правила своего типа в разделе не показывается и операциями
 * не меняется.
 */
object SizeTokenNaming {
    /** Радиус «полного скругления»: показывается, но его значение не правится. */
    const val FULL_ROUNDING = "round.circle"

    /** Варианты размера тени в порядке экрана: направление и жёсткость. */
    val SHADOW_VARIANTS: List<String> = listOf("down.soft", "down.hard", "up.soft", "up.hard")

    private const val RADIUS_PREFIX = "round"
    private const val SPACING_PREFIX = "spacing"
    private const val SEGMENT = "[a-z0-9]+(?:-[a-z0-9]+)*"
    private val SEGMENT_RULE = Regex("^$SEGMENT$")
    private val RADIUS_RULE = Regex("""^$RADIUS_PREFIX\.$SEGMENT$""")
    private val SPACING_RULE = Regex("""^$SPACING_PREFIX\.$SEGMENT$""")
    private val SHADOW_RULE = Regex("""^(?:down|up)\.(?:soft|hard)\.$SEGMENT$""")

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

    /** Полное имя радиуса или отступа с последним сегментом [name]; для тени — имена четырёх вариантов размера. */
    fun fullNames(kind: SizeTokenKind, name: String): List<String> = when (kind) {
        SizeTokenKind.RADIUS -> listOf("$RADIUS_PREFIX.$name")
        SizeTokenKind.SPACING -> listOf("$SPACING_PREFIX.$name")
        SizeTokenKind.SHADOW -> shadowSizeNames(name)
    }

    /** Размер тени — последний сегмент имени варианта, например `m` у `up.hard.m`. */
    fun shadowSize(name: String): String = name.substringAfterLast('.')

    /** Вариант тени — имя без размера, например `up.hard` у `up.hard.m`. */
    fun shadowVariant(name: String): String = name.substringBeforeLast('.')

    /** Имена четырёх вариантов размера тени [size]. */
    fun shadowSizeNames(size: String): List<String> = SHADOW_VARIANTS.map { "$it.$size" }

    /**
     * Отображаемое имя по правилу сида: сегменты в camelCase, `round.xxxl` → `roundXxxl`,
     * `down.soft.xl` → `downSoftXl`, `spacing.14x` → `spacing14x`.
     */
    fun displayName(fullName: String): String = fullName.split('.', '-')
        .filter(String::isNotEmpty)
        .mapIndexed { index, part -> if (index == 0) part else part.replaceFirstChar(Char::uppercaseChar) }
        .joinToString("")
}
