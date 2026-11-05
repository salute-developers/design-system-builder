package com.dsbuilder.frontend.platform.web

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem

/** Переменная окружения с путём к каталогу web-генератора (`js/cli` репозитория DS Builder). */
internal const val WEB_TOOL_ENV: String = "DSBUILDER_WEB_TOOL"

/** Исполняемый файл, которым запускаются скрипты web-генератора. */
internal const val NPM_EXECUTABLE: String = "npm"

/** Команда глобально установленного web-генератора. */
internal const val WEB_GENERATOR_EXECUTABLE: String = "dsbuilder-web-generator"

/** Каталог управляемой установки генератора относительно домашнего: npm prefix для `toolchain install web`. */
internal val MANAGED_WEB_PREFIX: List<String> = listOf(".dsbuilder", "toolchains", "web")

/** npm-пакет web-генератора. */
internal const val WEB_GENERATOR_PACKAGE: String = "@sddsjs/design-system-builder-generator"

/** Подсказка, когда генератора нет ни по явному пути, ни глобально. */
internal const val MISSING_GENERATOR_HINT: String =
    "The web generator was not found. Install it with `dsbuilder toolchain install web` " +
        "(requires Node.js 22+ and npm), or set $WEB_TOOL_ENV or pass --tool with the path to js/cli " +
        "of the DS Builder repository."

/** Подсказка, когда в `PATH` нет `npm`. */
internal const val MISSING_NPM_HINT: String = "$NPM_EXECUTABLE was not found in PATH. Install Node.js 22+."

/** Найденный web-генератор. */
internal sealed interface WebTool {
    /** Каталог `js/cli` репозитория: скрипты запускаются через `npm run`. */
    data class Directory(val path: String, val npm: String) : WebTool

    /** Глобально установленная команда `dsbuilder-web-generator`. */
    data class Global(val executable: String) : WebTool
}

/** Результат поиска web-генератора. */
internal sealed interface WebToolLookup {
    /** Генератор найден. */
    data class Found(val tool: WebTool) : WebToolLookup

    /** Генератора нет; [hint] объясняет, что проверялось и как его поставить. */
    data class Missing(val hint: String) : WebToolLookup
}

/**
 * Поиск web-генератора и `npm`.
 *
 * Порядок: каталог из `--tool`, каталог из [WEB_TOOL_ENV], управляемая установка
 * `~/.dsbuilder/toolchains/web` (её делает `dsbuilder toolchain install web`), команда
 * [WEB_GENERATOR_EXECUTABLE] в `PATH`, затем в каталоге команд `npm prefix -g`. Каталог признаётся
 * генератором, если в нём есть `package.json`. Явно названный, но неверный каталог — ошибка: молча взять
 * установленную версию вместо указанной разработчиком нельзя.
 */
internal class WebToolLocator(
    private val fileSystem: WorkspaceFileSystem,
    private val environmentReader: EnvironmentReader,
    private val processRunner: ProcessRunner,
) {
    /**
     * Находит генератор.
     *
     * @param override значение `--tool`; уже приведено к абсолютному пути вызывающим.
     */
    fun locate(override: String?): WebToolLookup {
        val configured = environmentReader.get(WEB_TOOL_ENV)?.takeIf { it.isNotBlank() }
        val directory = override ?: configured
        if (directory != null) {
            return locateDirectory(directory, source = if (override != null) "--tool" else WEB_TOOL_ENV)
        }
        return locateInstalled()?.let { WebToolLookup.Found(WebTool.Global(it)) }
            ?: WebToolLookup.Missing(MISSING_GENERATOR_HINT)
    }

    /** Явно названный каталог генератора; [source] — откуда взят путь, для подсказки. */
    private fun locateDirectory(directory: String, source: String): WebToolLookup {
        if (!fileSystem.exists(fileSystem.resolve(directory, PACKAGE_JSON))) {
            return WebToolLookup.Missing(
                "The web generator (package.json) was not found at $directory, the path given by $source.",
            )
        }
        return locateNpm()?.let { WebToolLookup.Found(WebTool.Directory(directory, it)) }
            ?: WebToolLookup.Missing(MISSING_NPM_HINT)
    }

    /**
     * Установленная команда генератора: управляемая установка, затем `PATH`, затем каталог команд
     * глобального prefix npm. `npm prefix -g` запускается, только если раньше команда не нашлась.
     */
    fun locateInstalled(): String? = managedExecutable()
        ?: findInPath(generatorExecutable())
        ?: globalPrefix()?.let { prefix -> executableIn(prefix).takeIf { fileSystem.exists(it) } }

    /**
     * Каталог управляемой установки `~/.dsbuilder/toolchains/web` либо `null`, когда домашний каталог
     * неизвестен: `HOME`, на Windows без него — `USERPROFILE`.
     */
    fun managedPrefix(): String? {
        val home = environmentReader.get("HOME")?.takeIf { it.isNotBlank() }
            ?: environmentReader.get("USERPROFILE")?.takeIf { it.isNotBlank() && isWindows() }
            ?: return null
        return MANAGED_WEB_PREFIX.fold(home) { parent, child -> fileSystem.resolve(parent, child) }
    }

    /** Команда генератора в управляемой установке, если она там есть. */
    fun managedExecutable(): String? = managedPrefix()?.let(::executableIn)?.takeIf { fileSystem.exists(it) }

    /** Абсолютный путь `npm` из `PATH` либо `null`: `ProcessRunner` принимает только абсолютный путь. */
    fun locateNpm(): String? = findInPath(if (isWindows()) "npm.cmd" else NPM_EXECUTABLE)

    /** Абсолютный рабочий каталог процесса `dsbuilder`. */
    fun workingDirectory(): String = fileSystem.currentWorkingDirectory()

    private fun globalPrefix(): String? {
        val npm = locateNpm() ?: return null
        val result = try {
            processRunner.run(
                ProcessRequest(
                    executable = npm,
                    args = listOf("prefix", "-g"),
                    workingDirectory = fileSystem.currentWorkingDirectory(),
                    inheritStdio = false,
                ),
            )
        } catch (_: ProcessLaunchException) {
            return null
        }
        return result.output.trim().lineSequence().lastOrNull()?.trim()
            ?.takeIf { result.exitCode == 0 && it.isNotEmpty() }
    }

    /** Команда генератора в npm prefix: `<prefix>/bin/<команда>`, на Windows `<prefix>\\<команда>.cmd`. */
    private fun executableIn(prefix: String): String =
        if (isWindows()) {
            fileSystem.resolve(
                prefix,
                generatorExecutable(),
            )
        } else {
            fileSystem.resolve(fileSystem.resolve(prefix, "bin"), generatorExecutable())
        }

    private fun generatorExecutable(): String =
        if (isWindows()) "$WEB_GENERATOR_EXECUTABLE.cmd" else WEB_GENERATOR_EXECUTABLE

    private fun findInPath(executable: String): String? = environmentReader.get("PATH")
        ?.split(if (isWindows()) ";" else ":")
        ?.filter { it.isNotBlank() }
        ?.map { fileSystem.resolve(it, executable) }
        ?.firstOrNull { fileSystem.exists(it) }

    /** Windows определяется по рабочему каталогу: `C:\...` или UNC-путь. */
    private fun isWindows(): Boolean {
        val workingDirectory = fileSystem.currentWorkingDirectory()
        return workingDirectory.startsWith("\\\\") ||
            (
                workingDirectory.length >= 3 && workingDirectory[1] == ':' &&
                    workingDirectory[2] in charArrayOf('\\', '/')
                )
    }

    private companion object {
        const val PACKAGE_JSON = "package.json"
    }
}
