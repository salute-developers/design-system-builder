package com.dsbuilder.frontend.platform.ios

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.platform.ToolchainId
import com.dsbuilder.frontend.core.platform.ToolchainInstallRequest
import com.dsbuilder.frontend.core.platform.ToolchainInstallResult
import com.dsbuilder.frontend.core.platform.ToolchainInstaller
import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem

/** Каталог управляемых установок iOS-инструмента: рядом лежат версии и симлинк `current`. */
internal const val MANAGED_TOOLCHAIN_ROOT: String = ".dsbuilder/toolchains/ios"

internal const val CURL: String = "/usr/bin/curl"
private const val UNZIP: String = "/usr/bin/unzip"
private const val RM: String = "/bin/rm"
private const val MV: String = "/bin/mv"
private const val LN: String = "/bin/ln"
private const val CHMOD: String = "/bin/chmod"

/**
 * Установщик iOS-инструмента: кладёт релиз plasma-ios в `~/.dsbuilder/toolchains/ios/<версия>`
 * и переставляет на неё симлинк `current`, по которому инструмент ищет locator.
 *
 * Kotlin-клиент не вшивает Swift-бинарь в себя: артефакты остаются независимыми, а связывает их
 * эта команда. Распаковку и симлинк делают системные утилиты — в Kotlin/Native их аналогов нет.
 */
public class IosToolchainInstaller internal constructor(
    private val processRunner: ProcessRunner,
    private val fileSystem: WorkspaceFileSystem,
    private val environmentReader: EnvironmentReader,
    private val releaseSource: (String) -> IosReleaseSource,
) : ToolchainInstaller {
    override val toolchain: ToolchainId = ToolchainId("ios")

    override fun install(request: ToolchainInstallRequest): ToolchainInstallResult {
        val home = environmentReader.get("HOME")?.takeIf { it.isNotBlank() }
            ?: return ToolchainInstallResult.Failed("Cannot install the toolchain: HOME is not set.")
        val root = fileSystem.resolve(home, MANAGED_TOOLCHAIN_ROOT)
        // Каталог установок — рабочая директория всех запусков, включая самый первый: без него
        // процесс не стартует, а первая установка происходит именно на пустой машине.
        fileSystem.createDirectories(root)

        return when (val source = resolveSource(request, root)) {
            is SourceRead.Failed -> ToolchainInstallResult.Failed(source.message)
            is SourceRead.Resolved -> download(source, root)
        }
    }

    /** `--from` ставит готовый архив и в сеть за релизом не ходит. */
    private fun resolveSource(request: ToolchainInstallRequest, root: String): SourceRead {
        val archive = request.archive
            ?: return when (val release = releaseSource(root).resolve(request.version)) {
                is ReleaseRead.Failed -> SourceRead.Failed(release.message)
                is ReleaseRead.Found -> SourceRead.Resolved(release.version, release.downloadUrl, remote = true)
            }

        val version = request.version ?: versionFromArchiveName(archive)
        val remote = archive.startsWith("http://") || archive.startsWith("https://")
        if (!remote && !fileSystem.exists(archive)) {
            return SourceRead.Failed("Archive $archive does not exist.")
        }

        return SourceRead.Resolved(version, archive, remote = remote)
    }

    private fun download(source: SourceRead.Resolved, root: String): ToolchainInstallResult {
        val staging = fileSystem.resolve(root, ".staging")
        remove(staging, root)
        fileSystem.createDirectories(staging)

        if (!source.remote) {
            return unpack(source.url, staging, root, source.version)
        }

        val archive = fileSystem.resolve(staging, "$IOS_RELEASE_ASSET_PREFIX.zip")
        val arguments = listOf("--fail", "--silent", "--show-error", "--location", "--output", archive, source.url)
        val fetched = run(CURL, arguments, root)

        return if (fetched.exitCode == 0) {
            unpack(archive, staging, root, source.version)
        } else {
            ToolchainInstallResult.Failed("Cannot download ${source.url}: ${fetched.describe()}")
        }
    }

    /**
     * Распаковка идёт в отдельный каталог и только потом становится версией: неудачная установка
     * не должна оставлять полураспакованное дерево там, куда смотрит `current`.
     */
    private fun unpack(archive: String, staging: String, root: String, version: String): ToolchainInstallResult {
        val unpacked = fileSystem.resolve(staging, "unpacked")
        val extracted = run(UNZIP, listOf("-o", "-q", archive, "-d", unpacked), root)
        if (extracted.exitCode != 0) {
            return ToolchainInstallResult.Failed("Cannot unpack $archive: ${extracted.describe()}")
        }

        val toolDirectory = findToolDirectory(unpacked)
            ?: return ToolchainInstallResult.Failed(
                "Archive $archive has no $IOS_TOOL_EXECUTABLE inside.",
            )

        return activate(toolDirectory, root, version)
    }

    private fun activate(toolDirectory: String, root: String, version: String): ToolchainInstallResult {
        val target = fileSystem.resolve(root, version)
        remove(target, root)
        val moved = run(MV, listOf(toolDirectory, target), root)
        if (moved.exitCode != 0) {
            return ToolchainInstallResult.Failed("Cannot install into $target: ${moved.describe()}")
        }

        val executable = fileSystem.resolve(target, IOS_TOOL_EXECUTABLE)
        run(CHMOD, listOf("+x", executable), root)

        val current = fileSystem.resolve(root, "current")
        remove(current, root)
        val linked = run(LN, listOf("-s", target, current), root)
        if (linked.exitCode != 0) {
            return ToolchainInstallResult.Failed("Cannot point current at $target: ${linked.describe()}")
        }

        remove(fileSystem.resolve(root, ".staging"), root)

        return ToolchainInstallResult.Installed(version = version, executable = executable)
    }

    /** Бинарь может лежать как в корне архива, так и в одной вложенной папке. */
    private fun findToolDirectory(unpacked: String): String? {
        if (fileSystem.exists(fileSystem.resolve(unpacked, IOS_TOOL_EXECUTABLE))) {
            return unpacked
        }

        return fileSystem.listFiles(unpacked)
            .filter { fileSystem.isDirectory(it) }
            .firstOrNull { fileSystem.exists(fileSystem.resolve(it, IOS_TOOL_EXECUTABLE)) }
    }

    /** Удаляем только внутри каталога установок: сюда приходят собранные нами пути, но `rm -rf` ошибок не прощает. */
    private fun remove(path: String, root: String) {
        if (path.startsWith("$root/")) {
            run(RM, listOf("-rf", path), root)
        }
    }

    private fun run(executable: String, args: List<String>, workingDirectory: String): RunResult {
        fileSystem.createDirectories(workingDirectory)

        return try {
            val result = processRunner.run(
                ProcessRequest(
                    executable = executable,
                    args = args,
                    workingDirectory = workingDirectory,
                    inheritStdio = false,
                ),
            )
            RunResult(exitCode = result.exitCode, output = result.output)
        } catch (error: ProcessLaunchException) {
            RunResult(exitCode = LAUNCH_FAILURE, output = "$executable cannot be started: ${error.message}")
        }
    }

    /** `dsbuilder-ios-cli-release-01-09-2026.zip` → `release-01-09-2026`. */
    private fun versionFromArchiveName(archive: String): String {
        val name = archive.substringAfterLast('/').removeSuffix(".zip")

        return name.removePrefix("$IOS_RELEASE_ASSET_PREFIX-").takeIf { it.isNotBlank() && it != name } ?: "local"
    }

    private companion object {
        private const val LAUNCH_FAILURE = -1
    }
}

private data class RunResult(
    val exitCode: Int,
    val output: String,
) {
    fun describe(): String = output.trim().ifBlank { "exit code $exitCode" }
}

private sealed interface SourceRead {
    data class Resolved(val version: String, val url: String, val remote: Boolean) : SourceRead

    data class Failed(val message: String) : SourceRead
}
