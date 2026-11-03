package com.dsbuilder.frontend.platform.web

import com.dsbuilder.frontend.core.platform.ToolchainId
import com.dsbuilder.frontend.core.platform.ToolchainInstallRequest
import com.dsbuilder.frontend.core.platform.ToolchainInstallResult
import com.dsbuilder.frontend.core.platform.ToolchainInstaller
import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessRunner

/**
 * Установщик toolchain `web`: ставит npm-пакет web-генератора в каталог пользователя
 * `~/.dsbuilder/toolchains/web` (`npm install --global --prefix`).
 *
 * Глобальный prefix npm часто принадлежит root (Node.js из официального установщика, `n`), поэтому он не
 * используется: установка не требует `sudo` и не меняет настройки npm. Версии в каталоге ведёт npm, без
 * `current`; повторная установка заменяет пакет. Делегат находит команду там раньше, чем в `PATH`.
 */
public class WebToolchainInstaller internal constructor(
    private val processRunner: ProcessRunner,
    private val locator: WebToolLocator,
) : ToolchainInstaller {
    override val toolchain: ToolchainId = ToolchainId("web")

    override fun install(request: ToolchainInstallRequest): ToolchainInstallResult {
        val npm = locator.locateNpm()
            ?: return ToolchainInstallResult.Failed("$MISSING_NPM_HINT Then run dsbuilder toolchain install web.")
        val prefix = locator.managedPrefix()
            ?: return ToolchainInstallResult.Failed("Cannot install the toolchain: HOME is not set.")
        // `--from` — путь к архиву или каталогу пакета; npm разрешает относительный путь от рабочего каталога.
        val spec = request.archive ?: "$WEB_GENERATOR_PACKAGE@${request.version ?: "latest"}"
        return installPackage(npm, prefix, spec) ?: installedGenerator(prefix)
    }

    /** `npm install --global --prefix <prefix> <spec>` с выводом в терминал; `null` — установка прошла. */
    private fun installPackage(npm: String, prefix: String, spec: String): ToolchainInstallResult.Failed? {
        val result = try {
            processRunner.run(
                ProcessRequest(
                    executable = npm,
                    args = listOf("install", "--global", "--prefix", prefix, spec),
                    workingDirectory = locator.workingDirectory(),
                ),
            )
        } catch (error: ProcessLaunchException) {
            return ToolchainInstallResult.Failed("$npm cannot be started: ${error.message}")
        }
        return ToolchainInstallResult.Failed(
            "npm install --global --prefix $prefix $spec failed with exit code ${result.exitCode}, " +
                "see the npm output above. Check the network and retry: dsbuilder toolchain install web.",
        ).takeIf { result.exitCode != 0 }
    }

    /** Установленная команда и её версия: делегат найдёт её там же раньше, чем в `PATH`. */
    private fun installedGenerator(prefix: String): ToolchainInstallResult {
        val executable = locator.managedExecutable()
            ?: return ToolchainInstallResult.Failed(
                "$WEB_GENERATOR_PACKAGE was installed, but $WEB_GENERATOR_EXECUTABLE was not found in $prefix.",
            )
        return try {
            val version = processRunner.run(
                ProcessRequest(
                    executable = executable,
                    args = listOf("--version"),
                    workingDirectory = locator.workingDirectory(),
                    inheritStdio = false,
                ),
            )
            if (version.exitCode == 0) {
                ToolchainInstallResult.Installed(version = version.output.trim(), executable = executable)
            } else {
                ToolchainInstallResult.Failed("$executable --version failed with exit code ${version.exitCode}.")
            }
        } catch (error: ProcessLaunchException) {
            ToolchainInstallResult.Failed("$executable cannot be started: ${error.message}")
        }
    }
}
