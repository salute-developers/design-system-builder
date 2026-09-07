package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import okio.BufferedSink

/**
 * Файловая система в памяти.
 *
 * Reader и writer пакета работают с текстовыми файлами и перечнем директории, поэтому диск
 * для их проверки не нужен: тест задаёт состояние прямо и читает результат прямо.
 */
internal class InMemoryWorkspaceFileSystem(
    private val root: String = "/work",
    initialFiles: Map<String, String> = emptyMap(),
) : WorkspaceFileSystem {
    val files: MutableMap<String, String> = initialFiles.toMutableMap()
    val createdDirectories: MutableList<String> = mutableListOf()

    /** Директории, объявленные существующими помимо созданных записью. */
    val directories: MutableSet<String> = mutableSetOf()

    override fun currentWorkingDirectory(): String = root

    override fun parent(path: String): String? = path.trimEnd('/').substringBeforeLast('/').ifEmpty { null }

    override fun resolve(parent: String, child: String): String =
        if (child.startsWith("/")) child else "${parent.trimEnd('/')}/$child"

    override fun absolutePath(path: String): String = path

    override fun exists(path: String): Boolean =
        path in files || path in directories || path in createdDirectories

    override fun createDirectories(path: String) {
        createdDirectories += path
    }

    override fun listFiles(path: String): List<String> =
        files.keys.filter { parent(it) == path.trimEnd('/') }

    override fun isDirectory(path: String): Boolean = path in directories || path in createdDirectories

    override fun readText(path: String): String = files.getValue(path)

    override fun writeText(path: String, text: String) {
        files[path] = text
    }

    // Двоичные операции пакетом не используются: конфигурации и `meta.json` — текст.
    override fun readBytes(path: String): ByteArray = error("не используется")

    override fun writeBytes(path: String, bytes: ByteArray): Unit = error("не используется")

    override fun sink(path: String): BufferedSink = error("не используется")

    override fun deleteFile(path: String) {
        files.remove(path)
    }
}
