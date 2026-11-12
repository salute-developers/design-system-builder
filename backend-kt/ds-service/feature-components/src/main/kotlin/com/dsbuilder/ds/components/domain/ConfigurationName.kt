package com.dsbuilder.ds.components.domain

/**
 * Имя конфигурации компонента — технический идентификатор в kebab-case: оно попадает в выгрузку (`styleName`, имя
 * файла конфига), в значение `appearance` и в имена сгенерированного кода.
 */
object ConfigurationName {
    /** Наибольшая длина имени. */
    const val MAX_LENGTH = 255

    private val pattern = Regex("^[a-z][a-z0-9]*(-[a-z0-9]+)*$")

    /** Код отказа для имени не по правилу. */
    const val INVALID_CODE = "appearance_name_invalid"

    /** Текст отказа для имени не по правилу. */
    const val INVALID_MESSAGE =
        "The configuration name must be kebab-case: lowercase latin letters and digits separated by hyphens"

    /** Код отказа для занятого имени, в том числе совпадающего с другим в сгенерированном коде. */
    const val TAKEN_CODE = "appearance_name_taken"

    /**
     * Ключ сравнения имён: имя без дефисов в нижнем регистре. Совпадает у имён с одним camelCase-идентификатором в коде
     * (`dense-2` и `dense2`) и у идентификаторов, которые различаются только регистром (на файловой системе без учёта
     * регистра это один файл конфига).
     */
    fun key(name: String): String = name.trim().replace("-", "").lowercase()

    /** Имя по правилу kebab-case и не длиннее допустимого. */
    fun isValid(name: String): Boolean = name.length <= MAX_LENGTH && pattern.matches(name)

    /** Kebab-case из произвольного текста: основа для сгенерированных имён (`TextField` → `text-field`). */
    fun kebab(value: String): String {
        val words = value.trim()
            .replace(Regex("([a-z0-9])([A-Z])"), "$1-$2")
            .replace(Regex("([A-Z])([A-Z][a-z])"), "$1-$2")
            .lowercase()
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
        return when {
            words.isEmpty() -> "configuration"
            !words.first().isLetter() -> "configuration-$words"
            else -> words
        }
    }
}
