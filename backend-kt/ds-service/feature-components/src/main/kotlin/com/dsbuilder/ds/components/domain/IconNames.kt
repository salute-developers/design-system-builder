package com.dsbuilder.ds.components.domain

/** Правила имён иконок и ключа старого формата. */
object IconNames {
    private val NAME = Regex("^[A-Z][A-Za-z0-9_]{0,63}$")
    private val WORD = Regex("[A-Z]+(?![a-z])|[A-Z][a-z]+|[a-z]+|[0-9]+")

    /** Возвращает [raw], если это допустимое каноническое имя; иначе `null`. */
    fun parse(raw: String): String? = raw.takeIf(NAME::matches)

    /** Начертание по самому длинному подходящему суффиксу имени (`OutlineBold` раньше `Outline`). */
    fun styleOf(
        name: String,
    ): IconStyle = IconStyle.entries.filter { name.endsWith(it.suffix) }.maxBy { it.suffix.length }

    /** Ключ старого формата: слова имени строчными через точку (`DisclosureDownFill` → `disclosure.down.fill`). */
    fun legacyKeyOf(name: String): String = WORD.findAll(name).joinToString(".") { it.value.lowercase() }
}
