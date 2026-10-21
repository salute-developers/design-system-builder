package com.dsbuilder.ds.components.application

/** Лимиты проверки и распаковки архива плагина. */
data class PluginArchiveLimits(
    /** Максимальный размер сжатого архива. */
    val maxCompressedBytes: Long = DEFAULT_MAX_COMPRESSED_BYTES,
    /** Максимальный суммарный распакованный размер. */
    val maxUncompressedBytes: Long = DEFAULT_MAX_UNCOMPRESSED_BYTES,
    /** Максимальное число файлов. */
    val maxEntries: Int = DEFAULT_MAX_ENTRIES,
    /** Максимальный размер одного файла. */
    val maxEntryBytes: Long = DEFAULT_MAX_ENTRY_BYTES,
    /** Максимальная длина пути в байтах UTF-8. */
    val maxPathBytes: Int = DEFAULT_MAX_PATH_BYTES,
) {
    /** Значения по умолчанию. */
    companion object {
        /** 50 МиБ. */
        const val DEFAULT_MAX_COMPRESSED_BYTES = 50L * 1024 * 1024

        /** 200 МиБ. */
        const val DEFAULT_MAX_UNCOMPRESSED_BYTES = 200L * 1024 * 1024

        /** 2000 файлов. */
        const val DEFAULT_MAX_ENTRIES = 2_000

        /** 100 МиБ. */
        const val DEFAULT_MAX_ENTRY_BYTES = 100L * 1024 * 1024

        /** 255 байт. */
        const val DEFAULT_MAX_PATH_BYTES = 255
    }
}
