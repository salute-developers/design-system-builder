package com.dsbuilder.ds.components.application

import java.io.ByteArrayInputStream
import java.io.IOException
import java.security.MessageDigest
import java.util.zip.ZipException
import java.util.zip.ZipInputStream

/** Безопасно распаковывает zip-архив плагина в память с жёсткими лимитами. */
object PluginArchiveReader {
    /** Читает [bytes]; нарушение любого лимита или правила пути даёт [PluginArchiveResult.Invalid]. */
    @Suppress("ReturnCount", "CyclomaticComplexMethod", "NestedBlockDepth")
    fun read(bytes: ByteArray, limits: PluginArchiveLimits = PluginArchiveLimits()): PluginArchiveResult {
        if (bytes.size.toLong() > limits.maxCompressedBytes) {
            return invalid("PLUGIN_ARCHIVE_TOO_LARGE", "Архив превышает ${limits.maxCompressedBytes} байт")
        }
        val files = linkedMapOf<String, ByteArray>()
        var total = 0L
        try {
            ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
                var entry = zip.nextEntry
                while (entry != null) {
                    if (!entry.isDirectory) {
                        pathProblem(entry.name, limits)?.let { return invalid("PLUGIN_ARCHIVE_UNSAFE_PATH", it) }
                        if (entry.name in files) {
                            return invalid("PLUGIN_ARCHIVE_DUPLICATE_PATH", "Путь повторяется: ${entry.name}")
                        }
                        if (files.size >= limits.maxEntries) {
                            return invalid("PLUGIN_ARCHIVE_TOO_MANY_FILES", "Больше ${limits.maxEntries} файлов")
                        }
                        val content = readEntry(zip, limits.maxEntryBytes, limits.maxUncompressedBytes - total)
                            ?: return invalid("PLUGIN_ARCHIVE_TOO_LARGE", "Превышен лимит размера файла или архива")
                        total += content.size
                        files[entry.name] = content
                    }
                    entry = zip.nextEntry
                }
            }
        } catch (_: ZipException) {
            return invalid("PLUGIN_ARCHIVE_INVALID", "Файл не является корректным zip-архивом")
        } catch (_: IOException) {
            return invalid("PLUGIN_ARCHIVE_INVALID", "Не удалось прочитать zip-архив")
        }
        if (files.isEmpty()) return invalid("PLUGIN_ARCHIVE_INVALID", "Архив не содержит файлов")
        return PluginArchiveResult.Valid(PluginArchive(files, bytes.size.toLong(), sha256Hex(bytes)))
    }

    private fun pathProblem(path: String, limits: PluginArchiveLimits): String? = when {
        path.isBlank() -> "Пустой путь"
        path.toByteArray(Charsets.UTF_8).size > limits.maxPathBytes -> "Путь длиннее ${limits.maxPathBytes} байт: $path"
        path.startsWith("/") || path.contains('\\') -> "Недопустимый путь: $path"
        path.split('/').any { it == ".." || it == "." || it.isEmpty() } -> "Недопустимый путь: $path"
        path.any { it.isISOControl() } -> "Недопустимые символы в пути: $path"
        else -> null
    }

    private fun readEntry(zip: ZipInputStream, entryLimit: Long, remainingTotal: Long): ByteArray? {
        val limit = minOf(entryLimit, remainingTotal)
        val buffer = ByteArray(BUFFER_SIZE)
        val out = java.io.ByteArrayOutputStream()
        var read = 0L
        while (true) {
            val count = zip.read(buffer)
            if (count < 0) break
            read += count
            if (read > limit) return null
            out.write(buffer, 0, count)
        }
        return out.toByteArray()
    }

    private fun invalid(code: String, message: String) = PluginArchiveResult.Invalid(code, message)

    private const val BUFFER_SIZE = 8 * 1024
}

/** sha256 в нижнем регистре, шестнадцатеричная запись. */
fun sha256Hex(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
