package com.dsbuilder.frontend.platform.web

import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.platform.Capability
import com.dsbuilder.frontend.core.platform.DelegateInvocation
import com.dsbuilder.frontend.core.platform.DelegateResult
import com.dsbuilder.frontend.core.platform.PlatformDelegate
import com.dsbuilder.frontend.core.platform.ToolchainId
import com.dsbuilder.frontend.core.platform.ToolchainStatus
import com.dsbuilder.frontend.core.platform.WorkspacePaths
import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessRunner

/**
 * Делегат платформы React: запускает web-генератор.
 *
 * Тема и компоненты генерируются раздельно, как у Android: `THEME`, `COMPONENTS`; `DESIGN_SYSTEM` — обе
 * части одним запуском (с `--package` — один полный пакет). Генератор берётся из каталога `js/cli`
 * (`--tool` или `DSBUILDER_WEB_TOOL`, запуск `npm run generate:*` из этого каталога) либо глобально
 * установленный `dsbuilder-web-generator` (запуск из рабочей копии). В обоих случаях генератору
 * передаются `.sdds` рабочей копии и каталог результата: заданный `--output` или `output` в рабочей
 * копии. Остальные аргументы (например, `--package`) передаются как есть, окружение — от `dsbuilder`.
 */
public class WebNpmDelegate internal constructor(
    private val processRunner: ProcessRunner,
    private val locator: WebToolLocator,
) : PlatformDelegate {
    override val toolchain: ToolchainId = ToolchainId("web")

    override val platforms: Set<TargetPlatform> = setOf(TargetPlatform.REACT)

    override val capabilities: Set<Capability> = COMMANDS.keys

    override fun doctor(workspace: WorkspacePaths, toolOverride: String?): ToolchainStatus {
        val tool = when (val lookup = locator.locate(toolOverride)) {
            is WebToolLookup.Missing -> return ToolchainStatus.Missing(lookup.hint)
            is WebToolLookup.Found -> lookup.tool
        }
        val (executable, workingDirectory, label) = when (tool) {
            // Версии у генератора в репозитории нет: сообщается версия npm, которым он запускается.
            is WebTool.Directory -> Triple(tool.npm, tool.path, NPM_EXECUTABLE)
            is WebTool.Global -> Triple(tool.executable, workspace.workspaceDir, WEB_GENERATOR_EXECUTABLE)
        }

        val result = try {
            processRunner.run(
                ProcessRequest(
                    executable = executable,
                    args = listOf("--version"),
                    workingDirectory = workingDirectory,
                    inheritStdio = false,
                ),
            )
        } catch (error: ProcessLaunchException) {
            return ToolchainStatus.Missing("$executable cannot be started: ${error.message}")
        }
        return if (result.exitCode == 0) {
            val location = if (tool is WebTool.Directory) tool.path else executable
            ToolchainStatus.Ready(executable = location, version = "$label ${result.output.trim()}")
        } else {
            ToolchainStatus.Missing("$executable --version failed with exit code ${result.exitCode}.")
        }
    }

    override fun run(invocation: DelegateInvocation): DelegateResult {
        val command = COMMANDS[invocation.capability]
            ?: return DelegateResult.Unsupported(
                "Toolchain 'web' does not support ${invocation.capability.label} for platform 'react'.",
            )
        val tool = when (val lookup = locator.locate(invocation.toolOverride)) {
            is WebToolLookup.Missing -> return DelegateResult.ToolchainMissing(lookup.hint)
            is WebToolLookup.Found -> lookup.tool
        }
        val request = when (tool) {
            // Скрипты разрешают код генератора относительно каталога пакета.
            is WebTool.Directory -> ProcessRequest(
                executable = tool.npm,
                args = listOf("run", "generate:$command", "--") + generatorArguments(invocation),
                workingDirectory = tool.path,
            )
            is WebTool.Global -> ProcessRequest(
                executable = tool.executable,
                args = listOf(command) + generatorArguments(invocation),
                workingDirectory = invocation.workspace.workspaceDir,
            )
        }
        val described = when (tool) {
            is WebTool.Directory -> "npm run generate:$command"
            is WebTool.Global -> "$WEB_GENERATOR_EXECUTABLE $command"
        }

        return try {
            val result = processRunner.run(request)
            if (result.exitCode == 0) {
                DelegateResult.Completed(summary = "$described completed from ${invocation.workspace.sddsDir}.")
            } else {
                DelegateResult.Failed(exitCode = result.exitCode, message = "see the output of $described above")
            }
        } catch (error: ProcessLaunchException) {
            DelegateResult.ToolchainMissing("${request.executable} cannot be started: ${error.message}")
        }
    }

    /** `--sdds <.sdds> --out <output> <passthrough>`: одинаково для скрипта и глобальной команды. */
    private fun generatorArguments(invocation: DelegateInvocation): List<String> = buildList {
        add("--sdds")
        add(invocation.workspace.sddsDir)
        add("--out")
        val workspaceDir = invocation.workspace.workspaceDir
        val separator = if (workspaceDir.contains('\\')) "\\" else "/"
        add(invocation.output ?: "${workspaceDir.trimEnd('/', '\\')}$separator$DEFAULT_OUTPUT_DIRECTORY")
        addAll(invocation.passthrough)
    }

    private companion object {
        /** Команда генератора по capability: `generate:<команда>` в репозитории, подкоманда глобально. */
        val COMMANDS: Map<Capability, String> = mapOf(
            Capability.THEME to "theme",
            Capability.COMPONENTS to "components",
            Capability.DESIGN_SYSTEM to "ds",
        )

        /** Каталог результата в рабочей копии, когда `--output` не задан; совпадает с умолчанием `js/cli`. */
        const val DEFAULT_OUTPUT_DIRECTORY = "output"
    }
}
