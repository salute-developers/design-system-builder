package com.dsbuilder.ds.components.domain

/** Идентификатор загрузки каталога: первые 12 hex-символов SHA-256 канонической записи содержимого. */
@JvmInline
value class IconCatalogLoadId(
    /** Значение из 12 hex-символов. */
    val value: String,
) {
    init {
        require(PATTERN.matches(value)) { "Invalid icon catalog load id" }
    }

    /** Формат идентификатора. */
    companion object {
        private val PATTERN = Regex("^[0-9a-f]{12}$")

        /** Разбор строки; неверный формат даёт `null`. */
        fun parse(raw: String): IconCatalogLoadId? = if (PATTERN.matches(raw)) IconCatalogLoadId(raw) else null
    }
}
