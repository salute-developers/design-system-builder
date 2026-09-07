package com.dsbuilder.frontend.core.workspace

import okio.buffer

/**
 * Файловая система в памяти для тестов `core-workspace`. Перенесено из `cli/DsBuilderCliTest.kt`.
 */
internal class FakeWorkspaceFileSystem(
    private val currentDirectory: String,
) : WorkspaceFileSystem {
    private val files = mutableMapOf<String, ByteArray>()
    private val directories = mutableSetOf<String>()

    override fun currentWorkingDirectory(): String = normalize(currentDirectory)

    override fun parent(path: String): String? {
        val normalized = normalize(path)
        if (normalized == "/") {
            return null
        }
        return normalized.substringBeforeLast("/", missingDelimiterValue = "")
            .ifBlank { "/" }
            .takeUnless { it == normalized }
    }

    override fun resolve(parent: String, child: String): String = normalize("${normalize(parent).trimEnd('/')}/$child")

    override fun absolutePath(path: String): String = normalize(path)

    override fun exists(path: String): Boolean {
        val normalized = normalize(path)
        return files.containsKey(normalized) || directories.contains(normalized)
    }

    override fun isDirectory(path: String): Boolean {
        return directories.contains(normalize(path))
    }

    override fun createDirectories(path: String) {
        directories += normalize(path)
    }

    override fun listFiles(path: String): List<String> {
        val directory = normalize(path).trimEnd('/')
        val result = mutableListOf<String>()
        result.addAll(files.keys.filter { parent(it) == directory }.sorted())
        result.addAll(directories.filter { parent(it) == directory }.sorted())
        return result
    }

    override fun readText(path: String): String =
        files[normalize(path)]?.decodeToString() ?: error("Missing file: $path")

    override fun readBytes(path: String): ByteArray =
        files[normalize(path)] ?: error("Missing file: $path")

    override fun writeText(path: String, text: String) {
        val normalized = normalize(path)
        parent(normalized)?.let { directories += it }
        files[normalized] = text.encodeToByteArray()
    }

    override fun writeBytes(path: String, bytes: ByteArray) {
        val normalized = normalize(path)
        parent(normalized)?.let { directories += it }
        files[normalized] = bytes
    }

    override fun sink(path: String): okio.BufferedSink {
        val normalized = normalize(path)
        parent(normalized)?.let { directories += it }
        val buffer = okio.Buffer()
        return object : okio.Sink {
            override fun write(source: okio.Buffer, byteCount: Long) {
                buffer.write(source, byteCount)
            }

            override fun flush() {
                // Sink flush — no-op for in-memory buffer
            }

            override fun close() {
                files[normalized] = buffer.readByteArray()
            }

            override fun timeout() = okio.Timeout.NONE
        }.buffer()
    }

    override fun deleteFile(path: String) {
        files.remove(normalize(path))
    }

    private fun normalize(path: String): String {
        val parts = path.split("/")
            .filter { it.isNotBlank() && it != "." }
            .fold(mutableListOf<String>()) { accumulator, part ->
                if (part == "..") {
                    if (accumulator.isNotEmpty()) {
                        accumulator.removeAt(accumulator.lastIndex)
                    }
                } else {
                    accumulator += part
                }
                accumulator
            }
        return "/" + parts.joinToString("/")
    }
}
