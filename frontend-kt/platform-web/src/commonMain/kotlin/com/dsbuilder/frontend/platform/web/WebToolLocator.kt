package com.dsbuilder.frontend.platform.web

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem

/** Переменная окружения с путём к каталогу web-генератора (`js/cli` репозитория DS Builder). */
internal const val WEB_TOOL_ENV: String = "DSBUILDER_WEB_TOOL"

/** Исполняемый файл, которым запускаются скрипты web-генератора. */
internal const val NPM_EXECUTABLE: String = "npm"

/**
 * Поиск web-генератора и `npm`.
 *
 * Web-генератор — не устанавливаемый бинарь, а npm-пакет внутри репозитория DS Builder (`js/cli`),
 * который подключает код сервиса генерации по относительным путям. Поэтому его каталог задаётся
 * явно: `--tool` для отладки, переменная окружения для постоянной настройки. Каталог признаётся
 * инструментом, если в нём есть `package.json`.
 */
internal class WebToolLocator(
    private val fileSystem: WorkspaceFileSystem,
    private val environmentReader: EnvironmentReader,
) {
    /**
     * Возвращает абсолютный путь каталога web-генератора либо `null`.
     *
     * @param override значение `--tool`; уже приведено к абсолютному пути вызывающим.
     */
    fun locateTool(override: String?): String? {
        val directory = override ?: environmentReader.get(WEB_TOOL_ENV)?.takeIf { it.isNotBlank() }
        return directory?.takeIf { fileSystem.exists(fileSystem.resolve(it, PACKAGE_JSON)) }
    }

    /** Значение `DSBUILDER_WEB_TOOL`, если задано, — для подсказки, какой путь проверялся. */
    fun configuredTool(): String? = environmentReader.get(WEB_TOOL_ENV)?.takeIf { it.isNotBlank() }

    /** Абсолютный путь `npm` из `PATH` либо `null`: `ProcessRunner` принимает только абсолютный путь. */
    fun locateNpm(): String? =
        environmentReader.get("PATH")
            ?.split(":")
            ?.filter { it.isNotBlank() }
            ?.map { fileSystem.resolve(it, NPM_EXECUTABLE) }
            ?.firstOrNull { fileSystem.exists(it) }

    private companion object {
        const val PACKAGE_JSON = "package.json"
    }
}
