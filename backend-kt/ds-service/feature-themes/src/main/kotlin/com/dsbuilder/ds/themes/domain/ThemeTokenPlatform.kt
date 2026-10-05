package com.dsbuilder.ds.themes.domain

/** Платформа значения токена темы. */
enum class ThemeTokenPlatform(
    /** Строковое значение PostgreSQL enum. */
    val wireValue: String,
) {
    /** Веб-платформа. */
    WEB("web"),

    /** Android-платформа. */
    ANDROID("android"),

    /** iOS-платформа. */
    IOS("ios"),
    ;

    companion object {
        /** Возвращает значение по строковому контракту. */
        fun fromWire(value: String?): ThemeTokenPlatform? = entries.firstOrNull { it.wireValue == value }
    }
}
