package com.dsbuilder.frontend.platform.ios

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem

/** Имя бинаря iOS-инструмента. */
internal const val IOS_TOOL_EXECUTABLE: String = "dsbuilder-ios"

/** Переменная окружения с явным путём к инструменту. */
internal const val IOS_TOOL_ENV: String = "DSBUILDER_IOS_TOOL"

/**
 * Где `toolchain install ios` держит активную версию.
 *
 * Версии лежат рядом в каталогах с именем тега, но выбирает активную установщик, а не поиск:
 * теги релизов iOS — даты вида `release-01-09-2026`, и сортировать их как строки нельзя.
 */
internal const val MANAGED_TOOLCHAIN_PATH: String = "$MANAGED_TOOLCHAIN_ROOT/current"

/**
 * Поиск инструмента iOS в фиксированном порядке: `--tool` → env → управляемая установка → `PATH`.
 *
 * Порядок неслучаен: явный флаг нужен для отладки локальной сборки, env — для CI, управляемая
 * установка — обычный путь, `PATH` — для тех, кто поставил бинарь сам.
 */
internal class IosToolchainLocator(
    private val fileSystem: WorkspaceFileSystem,
    private val environmentReader: EnvironmentReader,
) {
    /**
     * Возвращает абсолютный путь инструмента либо `null`, если его нет ни в одном из мест.
     *
     * @param override значение `--tool`; уже приведено к абсолютному пути вызывающим.
     */
    fun locate(override: String?): String? {
        if (override != null) {
            return override.takeIf { fileSystem.exists(it) }
        }

        return environmentTool() ?: managedTool() ?: pathTool()
    }

    /** Места, которые были проверены, — для сообщения о ненайденном инструменте. */
    fun checkedLocations(): List<String> = buildList {
        add("$IOS_TOOL_ENV env variable")
        add(managedTool() ?: "~/$MANAGED_TOOLCHAIN_PATH/$IOS_TOOL_EXECUTABLE")
        add("PATH")
    }

    private fun environmentTool(): String? =
        environmentReader.get(IOS_TOOL_ENV)?.takeIf { it.isNotBlank() && fileSystem.exists(it) }

    /** Инструмент активной установки: `~/.dsbuilder/toolchains/ios/current/dsbuilder-ios`. */
    private fun managedTool(): String? =
        environmentReader.get("HOME")
            ?.takeIf { it.isNotBlank() }
            ?.let { fileSystem.resolve(it, MANAGED_TOOLCHAIN_PATH) }
            ?.let { fileSystem.resolve(it, IOS_TOOL_EXECUTABLE) }
            ?.takeIf { fileSystem.exists(it) }

    private fun pathTool(): String? =
        environmentReader.get("PATH")
            ?.split(":")
            ?.filter { it.isNotBlank() }
            ?.map { fileSystem.resolve(it, IOS_TOOL_EXECUTABLE) }
            ?.firstOrNull { fileSystem.exists(it) }
}
