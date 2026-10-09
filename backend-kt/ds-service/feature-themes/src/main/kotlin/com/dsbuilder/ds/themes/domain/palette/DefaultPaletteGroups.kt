package com.dsbuilder.ds.themes.domain.palette

/** Группа токена по умолчанию — по правилу имени; никогда не выбирает пользовательскую группу. */
object DefaultPaletteGroups {
    private val modePrefix = Regex("^(light|dark)\\.")
    private val accent = Regex("accent|promo")
    private val status = Regex("positive|negative|warning|info")

    /** Системная группа для имени токена (с префиксом режима или без). */
    fun groupFor(tokenName: String): SystemPaletteGroup {
        val name = stripMode(tokenName)
        val last = name.substringAfterLast('.')
        return when {
            name.startsWith("data.") -> SystemPaletteGroup.DATA
            accent.containsMatchIn(last) -> SystemPaletteGroup.ACCENT
            status.containsMatchIn(last) -> SystemPaletteGroup.STATUS
            else -> SystemPaletteGroup.NEUTRAL
        }
    }

    /** Имя токена без префикса режима. */
    fun stripMode(tokenName: String): String = tokenName.replace(modePrefix, "")
}
