package com.dsbuilder.frontend.cli.core.config

import okio.BufferedSink

/**
 * Минимальная абстракция файловой системы для project config discovery, записи
 * `.sdds/config.json` и упаковки пакета документации в zip.
 */
public interface CliFileSystem {
    /**
     * Возвращает текущую рабочую директорию CLI.
     */
    public fun currentWorkingDirectory(): String

    /**
     * Возвращает parent directory или `null`, если parent отсутствует.
     */
    public fun parent(path: String): String?

    /**
     * Собирает дочерний путь относительно parent.
     */
    public fun resolve(parent: String, child: String): String

    /**
     * Возвращает абсолютный путь для переданного (относительного или абсолютного) пути.
     *
     * Используется для нормализации путей, приходящих из CLI-аргументов и опций —
     * гарантирует, что все дальнейшие файловые операции работают с одним и тем же
     * представлением пути вне зависимости от того, как он был указан.
     */
    public fun absolutePath(path: String): String

    /**
     * Проверяет существование пути.
     */
    public fun exists(path: String): Boolean

    /**
     * Создаёт директорию и отсутствующих родителей.
     */
    public fun createDirectories(path: String)

    /**
     * Возвращает direct child paths для директории или empty list, если директория отсутствует.
     */
    public fun listFiles(path: String): List<String>

    /**
     * Проверяет, является ли путь директорией.
     */
    public fun isDirectory(path: String): Boolean

    /**
     * Читает текстовый файл.
     */
    public fun readText(path: String): String

    /**
     * Читает файл как байтовый массив.
     */
    public fun readBytes(path: String): ByteArray

    /**
     * Записывает текстовый файл.
     */
    public fun writeText(path: String, text: String)

    /**
     * Записывает байтовый массив в файл.
     */
    public fun writeBytes(path: String, bytes: ByteArray)

    /**
     * Возвращает буферизованный sink для записи в файл.
     */
    public fun sink(path: String): BufferedSink

    /**
     * Удаляет файл, если он существует.
     */
    public fun deleteFile(path: String)
}
