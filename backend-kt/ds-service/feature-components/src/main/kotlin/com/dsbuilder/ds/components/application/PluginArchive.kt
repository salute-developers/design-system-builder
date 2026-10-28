package com.dsbuilder.ds.components.application

/** Распакованный архив плагина. */
class PluginArchive(
    /** Файлы по относительным путям. */
    val files: Map<String, ByteArray>,
    /** Размер сжатого архива. */
    val compressedBytes: Long,
    /** sha256 сжатого архива. */
    val sha256: String,
) {
    /** Суммарный распакованный размер. */
    val uncompressedBytes: Long get() = files.values.sumOf { it.size.toLong() }
}
