package com.dsbuilder.ds.themes.domain.typography

/** Имя токена стиля типографии `<экран>.<группа>.<размер>.<начертание>`. */
data class TypographyTokenName(
    /** Экран. */
    val screen: TypographyScreen,
    /** Стиль без экрана. */
    val style: TypographyStyleKey,
    /** Начертание. */
    val variant: TypographyVariant,
) {
    override fun toString(): String = "${screen.wireValue}.$style.${variant.wireValue}"

    companion object {
        /** Правило имени токена стиля. */
        val PATTERN = Regex("""^screen-(s|m|l)\.([a-z]+)\.([a-z0-9]+)\.(normal|medium|bold)$""")

        /** Разбирает имя токена или возвращает `null`, если оно вне правила стиля. */
        fun parse(name: String): TypographyTokenName? {
            val parts = PATTERN.matchEntire(name)?.groupValues ?: return null
            return TypographyTokenName(
                screen = requireNotNull(TypographyScreen.fromWire("screen-${parts[SCREEN]}")),
                style = TypographyStyleKey(parts[GROUP], parts[SIZE]),
                variant = requireNotNull(TypographyVariant.fromWire(parts[VARIANT])),
            )
        }

        /**
         * Стиль и начертание, на которые ссылается значение свойства компонента: имя с экраном
         * (`screen-l.body.m.bold`) или без него (`body.m.bold`); `null` — значение не ссылается на стиль.
         */
        fun reference(value: String): Pair<TypographyStyleKey, TypographyVariant>? {
            parse(value)?.let { return it.style to it.variant }
            return REFERENCE.matchEntire(value)?.destructured?.let { (group, size, variant) ->
                TypographyStyleKey(group, size) to requireNotNull(TypographyVariant.fromWire(variant))
            }
        }

        private const val SCREEN = 1
        private const val GROUP = 2
        private const val SIZE = 3
        private const val VARIANT = 4

        private val REFERENCE = Regex("""^([a-z]+)\.([a-z0-9]+)\.(normal|medium|bold)$""")
    }
}
