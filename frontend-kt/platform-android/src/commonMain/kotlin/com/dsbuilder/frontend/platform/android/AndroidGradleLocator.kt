package com.dsbuilder.frontend.platform.android

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem

/** Имя Gradle wrapper скрипта. */
internal const val GRADLEW_EXECUTABLE: String = "gradlew"

/**
 * Поиск `gradlew` подъёмом от рабочей директории вверх по дереву каталогов.
 *
 * У Android нет отдельного бинаря инструмента: есть Gradle-проект пользователя со своим wrapper'ом
 * в корне composite-сборки, а не в каждом модуле. Локатор поднимается от `workspaceDir` (включая
 * саму эту директорию) до первого найденного `gradlew` и не вычисляет Gradle project path —
 * вызывающий использует `-p <workspaceDir>`, поэтому знать точный путь проекта не нужно.
 */
internal class AndroidGradleLocator(
    private val fileSystem: WorkspaceFileSystem,
) {
    /**
     * Возвращает абсолютный путь `gradlew` либо `null`, если он не найден.
     *
     * @param workspaceDir директория, от которой начинается подъём.
     * @param override значение `--tool`; уже приведено к абсолютному пути вызывающим. Проверяется
     * ровно этот путь — поиск при отсутствующем файле не подменяет его найденным `gradlew`.
     */
    fun locate(workspaceDir: String, override: String?): String? {
        if (override != null) {
            return override.takeIf { fileSystem.exists(it) }
        }

        var current: String? = workspaceDir
        while (current != null) {
            val candidate = fileSystem.resolve(current, GRADLEW_EXECUTABLE)
            if (fileSystem.exists(candidate)) {
                return candidate
            }
            current = fileSystem.parent(current)
        }
        return null
    }
}
