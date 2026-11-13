package com.dsbuilder.frontend.core.domain

/**
 * Координаты API, сохраняющие происхождение снимка без требования совпадения с локальной библиотекой.
 * @property libraryId стабильное имя библиотеки Core.
 * @property platform каноническая платформа каталога.
 * @property version опубликованная версия Core.
 */
public data class CoreReleaseRef(public val libraryId: String, public val platform: String, public val version: String)
