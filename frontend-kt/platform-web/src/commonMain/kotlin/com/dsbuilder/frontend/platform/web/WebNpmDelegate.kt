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
 * Делегат платформы React: запускает npm-скрипты web-генератора `js/cli` репозитория DS Builder.
 *
 * Тема и компоненты генерируются раздельно, как у Android: `THEME` — `generate:theme`,
 * `COMPONENTS` — `generate:components`; `DESIGN_SYSTEM` — `generate:ds`, обе части одним запуском
 * (с `--package` — один полный пакет). Генератору передаётся `.sdds` рабочей копии и, если задан,
 * каталог результата; остальные аргументы (например, `--package`) — как есть.
 *
 * Инструмент ищется только по явному пути (`--tool` или `DSBUILDER_WEB_TOOL`): установщика нет,
 * генератор живёт в репозитории и запускается рядом с ним.
 */
public class WebNpmDelegate internal constructor(
    private val processRunner: ProcessRunner,
    private val locator: WebToolLocator,
) : PlatformDelegate {
    override val toolchain: ToolchainId = ToolchainId("web")

    override val platforms: Set<TargetPlatform> = setOf(TargetPlatform.REACT)

    override val capabilities: Set<Capability> =
        setOf(Capability.THEME, Capability.COMPONENTS, Capability.DESIGN_SYSTEM)

    override fun doctor(workspace: WorkspacePaths, toolOverride: String?): ToolchainStatus {
        val (tool, npm) = when (val located = locate(toolOverride)) {
            is Located.Missing -> return ToolchainStatus.Missing(located.hint)
            is Located.Found -> located
        }

        val result = try {
            processRunner.run(
                ProcessRequest(
                    executable = npm,
                    args = listOf("--version"),
                    workingDirectory = tool,
                    inheritStdio = false,
                ),
            )
        } catch (error: ProcessLaunchException) {
            return ToolchainStatus.Missing("$npm cannot be started: ${error.message}")
        }
        return if (result.exitCode == 0) {
            // Версии у генератора нет: он живёт в репозитории; сообщается версия npm, которым он запускается.
            ToolchainStatus.Ready(executable = tool, version = "npm ${result.output.trim()}")
        } else {
            ToolchainStatus.Missing("$npm --version failed with exit code ${result.exitCode}.")
        }
    }

    override fun run(invocation: DelegateInvocation): DelegateResult {
        val script = SCRIPTS[invocation.capability]
            ?: return DelegateResult.Unsupported(
                "Toolchain 'web' does not support ${invocation.capability.label} for platform 'react'.",
            )
        val (tool, npm) = when (val located = locate(invocation.toolOverride)) {
            is Located.Missing -> return DelegateResult.ToolchainMissing(located.hint)
            is Located.Found -> located
        }

        return try {
            val result = processRunner.run(
                ProcessRequest(executable = npm, args = arguments(script, invocation), workingDirectory = tool),
            )
            if (result.exitCode == 0) {
                DelegateResult.Completed(summary = "$script completed from ${invocation.workspace.sddsDir}.")
            } else {
                DelegateResult.Failed(exitCode = result.exitCode, message = "see the output of npm run $script above")
            }
        } catch (error: ProcessLaunchException) {
            DelegateResult.ToolchainMissing("$npm cannot be started: ${error.message}")
        }
    }

    /** Каталог генератора и `npm` либо подсказка, чего не хватает. */
    private fun locate(toolOverride: String?): Located {
        val tool = locator.locateTool(toolOverride) ?: return Located.Missing(missingToolHint(toolOverride))
        val npm = locator.locateNpm() ?: return Located.Missing(MISSING_NPM_HINT)
        return Located.Found(tool, npm)
    }

    /** Результат поиска инструмента. */
    private sealed interface Located {
        data class Found(val tool: String, val npm: String) : Located

        data class Missing(val hint: String) : Located
    }

    /** `npm run <script> -- --sdds <.sdds> [--out <output>] <passthrough>`. */
    private fun arguments(script: String, invocation: DelegateInvocation): List<String> = buildList {
        add("run")
        add(script)
        add("--")
        add("--sdds")
        add(invocation.workspace.sddsDir)
        invocation.output?.let {
            add("--out")
            add(it)
        }
        addAll(invocation.passthrough)
    }

    /** Названный в `--tool` путь важнее переменной окружения: проверялся именно он. */
    private fun missingToolHint(toolOverride: String?): String = if (toolOverride != null) {
        "The web generator (package.json) was not found at $toolOverride, the path given by --tool."
    } else {
        locator.configuredTool()?.let {
            "The web generator (package.json) was not found at $it, the path given by $WEB_TOOL_ENV."
        }
            ?: (
                "The web generator was not found. Set $WEB_TOOL_ENV or pass --tool with the path to js/cli " +
                    "of the DS Builder repository."
                )
    }

    private companion object {
        val SCRIPTS: Map<Capability, String> = mapOf(
            Capability.THEME to "generate:theme",
            Capability.COMPONENTS to "generate:components",
            Capability.DESIGN_SYSTEM to "generate:ds",
        )

        const val MISSING_NPM_HINT = "$NPM_EXECUTABLE was not found in PATH. Install Node.js."
    }
}
