package com.dsbuilder.frontend.cli.feature.toolchain.presentation

import com.dsbuilder.frontend.cli.presentation.targetPlatform
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.platform.ToolchainStatus
import com.dsbuilder.frontend.feature.toolchain.application.DoctorToolchainsCommand
import com.dsbuilder.frontend.feature.toolchain.application.DoctorToolchainsResult
import com.dsbuilder.frontend.feature.toolchain.application.DoctorToolchainsUseCase
import com.dsbuilder.frontend.feature.toolchain.application.InstallToolchainCommand
import com.dsbuilder.frontend.feature.toolchain.application.InstallToolchainResult
import com.dsbuilder.frontend.feature.toolchain.application.InstallToolchainUseCase
import com.dsbuilder.frontend.feature.toolchain.application.ListToolchainsUseCase
import com.dsbuilder.frontend.feature.toolchain.application.ToolchainDoctorEntry
import com.dsbuilder.frontend.feature.toolchain.application.ToolchainSummary
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.core.subcommands
import com.github.ajalt.clikt.parameters.arguments.argument
import com.github.ajalt.clikt.parameters.arguments.help
import com.github.ajalt.clikt.parameters.options.help
import com.github.ajalt.clikt.parameters.options.option

/**
 * Command group `toolchain`.
 */
internal class ToolchainCliCommand(
    listCommand: ToolchainListCliCommand,
    doctorCommand: ToolchainDoctorCliCommand,
    installCommand: ToolchainInstallCliCommand,
) : CliktCommand(name = "toolchain") {
    init {
        subcommands(listCommand, doctorCommand, installCommand)
    }

    override fun help(context: Context): String = "Inspect platform toolchains available to this CLI."

    override fun run(): Unit = Unit
}

/**
 * Presentation command для `dsbuilder toolchain list`.
 */
internal class ToolchainListCliCommand(
    private val listToolchainsUseCase: ListToolchainsUseCase,
) : CliktCommand(name = "list") {
    override fun run() {
        val toolchains = listToolchainsUseCase.execute()
        if (toolchains.isEmpty()) {
            echo("No platform toolchains are registered.")
            return
        }

        echo(toolchains.joinToString(separator = "\n\n", transform = ToolchainSummary::render))
    }

    override fun help(context: Context): String = "List registered platform toolchains."
}

/**
 * Presentation command для `dsbuilder toolchain doctor`.
 */
internal class ToolchainDoctorCliCommand(
    private val doctorToolchainsUseCase: DoctorToolchainsUseCase,
) : CliktCommand(name = "doctor") {
    private val platform: TargetPlatform? by option("--platform").targetPlatform()
        .help("Check only the toolchain serving this platform.")

    private val tool: String? by option("--tool")
        .help("Check this tool instead of the ones found by toolchain discovery.")

    override fun run() {
        val command = DoctorToolchainsCommand(platform = platform, toolOverride = tool)
        when (val result = doctorToolchainsUseCase.execute(command)) {
            is DoctorToolchainsResult.Checked -> echoChecked(result)
            is DoctorToolchainsResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    private fun echoChecked(result: DoctorToolchainsResult.Checked) {
        if (result.entries.isEmpty()) {
            echo("No platform toolchains are registered.")
            return
        }

        echo("Workspace: ${result.workspace.workspaceDir}")
        echo("")
        echo(result.entries.joinToString(separator = "\n\n", transform = ToolchainDoctorEntry::render))

        // Один непригодный инструмент — уже повод для ненулевого кода: в CI это единственный сигнал.
        if (result.entries.any { it.status !is ToolchainStatus.Ready }) {
            throw ProgramResult(statusCode = 1)
        }
    }

    override fun help(context: Context): String = "Check that platform tools are installed and compatible."
}

/**
 * Presentation command для `dsbuilder toolchain install`.
 */
internal class ToolchainInstallCliCommand(
    private val installToolchainUseCase: InstallToolchainUseCase,
) : CliktCommand(name = "install") {
    private val toolchain: String by argument("toolchain")
        .help("Toolchain to install, for example 'ios'.")

    private val version: String? by option("--version")
        .help("Install this release instead of the latest one.")

    private val from: String? by option("--from")
        .help("Install this archive (path or URL) instead of resolving a release.")

    override fun run() {
        val command = InstallToolchainCommand(toolchain = toolchain, version = version, archive = from)
        when (val result = installToolchainUseCase.execute(command)) {
            is InstallToolchainResult.Installed -> {
                echo("Installed ${result.toolchain} ${result.version} at ${result.executable}.")
            }

            is InstallToolchainResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String = "Install a platform toolchain and make it current."
}

private fun ToolchainSummary.render(): String = """
    Toolchain: $toolchain
    Platforms: ${platforms.joinToString { it.cliValue }}
    Capabilities: ${capabilities.joinToString { it.label }}
""".trimIndent()

private fun ToolchainDoctorEntry.render(): String = "${summary.render()}\n${status.render()}"

private fun ToolchainStatus.render(): String = when (this) {
    is ToolchainStatus.Ready -> "Status: ready ($version at $executable)"
    is ToolchainStatus.Missing -> "Status: missing — $hint"
    is ToolchainStatus.Incompatible -> "Status: incompatible (found $found, requires $required)"
}
