package com.dsbuilder.ds.app

/** Бакет, префикс и публичный адрес билдов одной платформы preview plugin. */
data class PreviewPluginStorageLocation(
    /** Бакет билдов платформы. */
    val bucket: String? = null,
    /** Префикс билдов платформы в бакете. */
    val prefix: String = "",
    /** Публичный адрес префикса платформы без завершающего `/`. */
    val publicBaseUrl: String? = null,
) {
    /** Корень ключей билдов в бакете, как его строит `S3PluginBuildStorage`. */
    internal val root: String
        get() = prefix.trim('/').let { if (it.isEmpty()) "builds/" else "$it/builds/" }

    /** Пересекаются ли ключи билдов с [other]: тогда очистка одной платформы удалила бы файлы другой. */
    internal fun overlaps(other: PreviewPluginStorageLocation): Boolean =
        bucket == other.bucket && (root.startsWith(other.root) || other.root.startsWith(root))
}
