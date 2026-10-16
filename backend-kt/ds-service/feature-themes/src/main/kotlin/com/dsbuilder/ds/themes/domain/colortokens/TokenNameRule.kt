package com.dsbuilder.ds.themes.domain.colortokens

/** Правило имени определения цветового токена: сегменты из `a-z`, `0-9` и `-`, без префикса режима. */
object TokenNameRule {
    private val SEGMENT = Regex("""^[a-z0-9]+(?:-[a-z0-9]+)*$""")
    private val MODES = setOf("light", "dark")

    /** Причина отказа для полного имени [fullName] или `null`, если имя допустимо. */
    fun validate(fullName: String): String? {
        val segments = fullName.split('.')
        return when {
            fullName.isBlank() -> "Имя токена не может быть пустым"
            segments.first() in MODES -> "Имя токена не должно начинаться с режима: $fullName"
            segments.any { !SEGMENT.matches(it) } -> "Имя токена содержит недопустимые символы: $fullName"
            else -> null
        }
    }

    /** Допустим ли отдельный сегмент имени — группа или имя токена. */
    fun validSegment(segment: String): Boolean = SEGMENT.matches(segment)
}
