package com.dsbuilder.frontend.cli.core.config

/**
 * Минимальная абстракция файловой системы для project config discovery и записи `.sdds/config.json`.
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
     * Проверяет существование пути.
     */
    public fun exists(path: String): Boolean

    /**
     * Создает директорию и отсутствующих родителей.
     */
    public fun createDirectories(path: String)

    /**
     * Возвращает direct child paths для директории или empty list, если директория отсутствует.
     */
    public fun listFiles(path: String): List<String>

    /**
     * Читает текстовый файл.
     */
    public fun readText(path: String): String

    /**
     * Записывает текстовый файл.
     */
    public fun writeText(path: String, text: String)

    /**
     * Удаляет файл, если он существует.
     */
    public fun deleteFile(path: String)
}
