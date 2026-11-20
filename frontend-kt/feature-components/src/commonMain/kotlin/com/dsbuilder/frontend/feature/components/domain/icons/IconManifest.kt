package com.dsbuilder.frontend.feature.components.domain.icons

/**
 * Пакет-источник каталога иконок.
 *
 * @property packageName имя пакета, всегда [IconManifestRules.PACKAGE_NAME].
 * @property version версия пакета или `unknown`.
 */
internal data class IconManifestSource(val packageName: String, val version: String)

/**
 * Иконка манифеста.
 *
 * @property name каноническое имя иконки, как в `@salutejs/sdds-icons` (например `AddOutline`).
 * @property category категория из метаданных SVG; `null`, если метаданных нет.
 * @property aliases синонимы для поиска (в том числе русские).
 * @property sizes размер в пикселях → содержимое SVG.
 */
internal data class IconManifestEntry(
    val name: String,
    val category: String?,
    val aliases: List<String>,
    val sizes: Map<Int, String>,
)

/**
 * Манифест каталога иконок: единый документ, который CLI отправляет на бэкенд.
 *
 * @property source пакет-источник.
 * @property icons иконки, упорядоченные по имени.
 */
internal data class IconManifest(val source: IconManifestSource, val icons: List<IconManifestEntry>) {
    /** Число иконок по размерам: размер → число иконок, у которых он есть. */
    fun sizeCounts(): Map<Int, Int> = IconManifestRules.SIZES.associateWith { size ->
        icons.count { size in it.sizes }
    }.filterValues { it > 0 }
}

/** Правила формата манифеста; совпадают с проверками бэкенда, чтобы отказ происходил до обращения к сети. */
internal object IconManifestRules {
    /** Версия формата манифеста. */
    const val SCHEMA_VERSION = 1

    /** Единственный допустимый пакет-источник. */
    const val PACKAGE_NAME = "@salutejs/sdds-icons"

    /** Версия пакета, когда её нельзя установить. */
    const val UNKNOWN_VERSION = "unknown"

    /** Размеры иконок в пикселях. */
    val SIZES: List<Int> = listOf(16, 24, 36)

    /** Предел размера одного SVG. */
    const val MAX_SVG_BYTES: Int = 64 * 1024

    /** Допустимое каноническое имя иконки. */
    val NAME: Regex = Regex("^[A-Z][A-Za-z0-9_]*$")
}
