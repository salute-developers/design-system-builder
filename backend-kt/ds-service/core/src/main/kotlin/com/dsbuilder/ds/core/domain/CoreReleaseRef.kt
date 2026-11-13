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
        /** Сопоставляет обозначения производителей с существующим словарём каталога. */
        fun canonicalPlatform(value: String): String? = when (value) {
            "web", "react" -> "web"
            "compose" -> "compose"
            "xml", "android-view" -> "xml"
            "ios", "swiftui", "uikit" -> "ios"
            else -> null
        }
    }
}
