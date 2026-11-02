package com.dsbuilder.ds.themes.domain.typography

/**
 * Имена токенов стиля типографии при создании и переименовании: девять токенов `<экран>.<группа>.<размер>.<начертание>`,
 * отображаемое имя и описание по правилу сида, текст ссылки компонента и токен, к которому она привязывается.
 */
object TypographyStyleNaming {
    private val SIZE_RULE = Regex("""^[a-z0-9]+$""")

    /** Допустим ли размер нового стиля: `a-z` и `0-9`, как в правиле имени токена. */
    fun validSize(size: String): Boolean = SIZE_RULE.matches(size)

    /** Входит ли группа в фиксированный набор групп. */
    fun knownGroup(group: String): Boolean = group in TypographyStyleKey.GROUPS

    /** Девять токенов стиля [style]: экраны от крупного к мелкому, начертания по порядку. */
    fun names(style: TypographyStyleKey): List<TypographyTokenName> = TypographyScreen.entries.flatMap { screen ->
        TypographyVariant.entries.map { variant -> TypographyTokenName(screen, style, variant) }
    }

    /** Отображаемое имя по правилу сида: `BodyM N`, `HeaderH1 B`. */
    fun displayName(name: TypographyTokenName): String =
        "${capitalize(name.style.group)}${capitalize(name.style.size)} ${variantLetter(name.variant)}"

    /** Описание по правилу сида: `typography s body-m`, `typography l header-h1-bold`. */
    fun description(name: TypographyTokenName): String {
        val variant = if (name.variant == TypographyVariant.NORMAL) "" else "-${name.variant.wireValue}"
        val screen = name.screen.wireValue.removePrefix("screen-")
        return "typography $screen ${name.style.group}-${name.style.size}$variant"
    }

    /** Текст ссылки свойства компонента на начертание стиля без экрана: `body.m.normal`. */
    fun reference(style: TypographyStyleKey, variant: TypographyVariant): String = "$style.${variant.wireValue}"

    /** Токен, к которому ссылка на начертание привязывается по `token_id`: экран `screen-s`. */
    fun anchor(style: TypographyStyleKey, variant: TypographyVariant) =
        TypographyTokenName(TypographyScreen.S, style, variant)

    private fun capitalize(value: String) = value.replaceFirstChar(Char::uppercaseChar)

    private fun variantLetter(variant: TypographyVariant) = when (variant) {
        TypographyVariant.NORMAL -> "N"
        TypographyVariant.MEDIUM -> "M"
        TypographyVariant.BOLD -> "B"
    }
}
