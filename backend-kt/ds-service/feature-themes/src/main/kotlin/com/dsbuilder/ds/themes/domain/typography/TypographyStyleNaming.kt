package com.dsbuilder.ds.themes.domain.typography

/**
 * Имена токенов стиля типографии при создании и переименовании: девять токенов `<экран>.<группа>.<размер>.<начертание>`,
 * правила имён группы и размера, отображаемое имя и описание по правилу сида, тексты ссылок компонента и токены, к
 * которым они привязываются.
 */
object TypographyStyleNaming {
    private val SIZE_RULE = Regex("""^[a-z0-9]+(?:-[a-z0-9]+)*$""")
    private val GROUP_RULE = Regex("""^[a-z]{1,32}$""")

    /** Имя, которое генератор пакета даёт группе `display`: группа с таким именем дала бы те же переменные. */
    private const val RESERVED_GROUP = "dspl"

    /** Допустимо ли имя стиля в группе: произвольное, `a-z`, `0-9` и `-` между ними, как имя радиуса. */
    fun validSize(size: String): Boolean = SIZE_RULE.matches(size)

    /** Допустимо ли имя группы: `a-z` до 32 знаков, как в правиле имени токена, кроме имени генератора `dspl`. */
    fun validGroup(group: String): Boolean = GROUP_RULE.matches(group) && group != RESERVED_GROUP

    /** Системная ли группа: Display, Header, Body и Text не переименовываются и не удаляются. */
    fun systemGroup(group: String): Boolean = group in TypographyStyleKey.GROUPS

    /** Девять токенов стиля [style]: экраны от крупного к мелкому, начертания по порядку. */
    fun names(style: TypographyStyleKey): List<TypographyTokenName> = TypographyScreen.entries.flatMap { screen ->
        TypographyVariant.entries.map { variant -> TypographyTokenName(screen, style, variant) }
    }

    /** Отображаемое имя по правилу сида: `BodyM N`, `HeaderH1 B`, `BodyPromoTitle N`. */
    fun displayName(name: TypographyTokenName): String {
        val size = name.style.size.split('-').joinToString("", transform = ::capitalize)
        return "${capitalize(name.style.group)}$size ${variantLetter(name.variant)}"
    }

    /** Описание по правилу сида: `typography s body-m`, `typography l header-h1-bold`. */
    fun description(name: TypographyTokenName): String {
        val variant = if (name.variant == TypographyVariant.NORMAL) "" else "-${name.variant.wireValue}"
        val screen = name.screen.wireValue.removePrefix("screen-")
        return "typography $screen ${name.style.group}-${name.style.size}$variant"
    }

    /** Текст ссылки свойства компонента на начертание стиля без экрана: `body.m.normal`. */
    fun reference(style: TypographyStyleKey, variant: TypographyVariant): String = "$style.${variant.wireValue}"

    /**
     * Тексты ссылок на начертание стиля, которые понимает чтение использования: без экрана (`body.m.normal`) и с
     * экраном (`screen-l.body.m.normal`); текст → токен, к которому ссылка привязывается по `token_id`.
     */
    fun references(style: TypographyStyleKey): Map<String, TypographyTokenName> = TypographyVariant.entries.flatMap {
            variant ->
        listOf(reference(style, variant) to anchor(style, variant)) +
            TypographyScreen.entries.map { screen ->
                TypographyTokenName(screen, style, variant).let { name -> name.toString() to name }
            }
    }.toMap()

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
