package com.dsbuilder.frontend.feature.toolchain.application

import com.dsbuilder.frontend.core.platform.ToolchainId
import com.dsbuilder.frontend.core.platform.ToolchainInstallRequest
import com.dsbuilder.frontend.core.platform.ToolchainInstallResult
import com.dsbuilder.frontend.core.platform.ToolchainInstallerRegistry

/**
 * Use case для команды `dsbuilder toolchain install`.
 *
 * Установка не зависит от проекта: инструмент кладётся в домашний каталог пользователя,
 * поэтому команда работает и в свежем checkout, и вовсе без него.
 */
public class InstallToolchainUseCase internal constructor(
    private val registry: ToolchainInstallerRegistry,
) {
    /**
     * Ставит запрошенный toolchain и делает его текущим.
     */
    public fun execute(command: InstallToolchainCommand): InstallToolchainResult {
        val toolchain = try {
            ToolchainId(command.toolchain)
        } catch (error: IllegalArgumentException) {
            return InstallToolchainResult.Failed("${error.message} ${installableHint()}")
        }

        val installer = registry.forToolchain(toolchain)
            ?: return InstallToolchainResult.Failed(
                "No installer is registered for toolchain '${toolchain.value}'. ${installableHint()}",
            )

        val request = ToolchainInstallRequest(version = command.version, archive = command.archive)

        return when (val result = installer.install(request)) {
            is ToolchainInstallResult.Installed -> InstallToolchainResult.Installed(
                toolchain = toolchain,
                version = result.version,
                executable = result.executable,
            )

            is ToolchainInstallResult.Failed -> InstallToolchainResult.Failed(result.message)
        }
    }

    private fun installableHint(): String {
        val installable = registry.all.joinToString { it.toolchain.value }

        return if (installable.isEmpty()) {
            "No toolchains can be installed by this client."
        } else {
            "Installable toolchains: $installable."
        }
    }
}

/**
 * Command model для [InstallToolchainUseCase].
 *
 * @property toolchain идентификатор toolchain'а из аргумента команды.
 * @property version тег релиза из `--version`; `null` — последний опубликованный.
 * @property archive путь или URL архива из `--from`; тогда релиз не разрешается.
 */
public data class InstallToolchainCommand(
    public val toolchain: String,
    public val version: String? = null,
    public val archive: String? = null,
)

/**
 * Результат команды `toolchain install`.
 */
public sealed interface InstallToolchainResult {
    /**
     * Инструмент установлен и стал текущим.
     *
     * @property toolchain какой toolchain поставили.
     * @property version установленная версия.
     * @property executable путь установленного инструмента.
     */
    public data class Installed(
        public val toolchain: ToolchainId,
        public val version: String,
        public val executable: String,
    ) : InstallToolchainResult

    /**
     * Установка не состоялась.
     *
     * @property message user-facing объяснение.
     */
    public data class Failed(
        public val message: String,
    ) : InstallToolchainResult
}
