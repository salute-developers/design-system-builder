package com.dsbuilder.ds.core.domain

/** Координаты неизменяемого API библиотеки; версия не выводится из содержимого меты. */
data class CoreReleaseRef(
    /** Стабильное имя библиотеки Core. */
    val libraryId: String,
    /** Платформа каталога: web, compose, xml или ios. */
    val platform: String,
    /** Версия Core, явно переданная производителем. */
    val version: String,
) {
    /** Проверяет непустые координаты и известное соответствие платформенных обозначений. */
    fun valid(): Boolean = libraryId.isNotBlank() && version.isNotBlank() && canonicalPlatform(platform) != null

    companion object {
        private val platforms = mapOf(
            "web" to "web",
            "react" to "web",
            "compose" to "compose",
            "xml" to "xml",
            "android-view" to "xml",
            "ios" to "ios",
            "swiftui" to "ios",
            "uikit" to "ios",
        )

        /** Сопоставляет обозначения производителей с существующим словарём каталога. */
        fun canonicalPlatform(value: String): String? = platforms[value]
    }
}
