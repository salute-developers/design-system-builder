package com.dsbuilder.frontend.core.domain

/**
 * Целевая платформа дизайн-системы, для которой клиент запускает платформенный инструмент.
 *
 * Значения совпадают с каноническими идентификаторами платформ документации, чтобы
 * `--platform` у всех команд принимал один и тот же словарь.
 *
 * @property cliValue значение, которое пользователь передаёт в `--platform` и которое хранится в `.sdds/config.json`.
 */
public enum class TargetPlatform(
    public val cliValue: String,
) {
    /** Jetpack Compose. */
    COMPOSE("compose"),

    /** Android View. */
    ANDROID_VIEW("android-view"),

    /** SwiftUI. */
    SWIFT_UI("swiftui"),

    /** React. */
    REACT("react"),
    ;

    public companion object {
        /** Допустимые значения `--platform` в порядке объявления. */
        public val cliValues: List<String> = entries.map { it.cliValue }

        /**
         * Разбирает точный canonical identifier без aliases и эвристик.
         *
         * @param value значение из CLI-аргумента или config.
         * @return платформа либо `null`, если значение неизвестно.
         */
        public fun fromCliValue(value: String): TargetPlatform? = entries.firstOrNull { it.cliValue == value }
    }
}
