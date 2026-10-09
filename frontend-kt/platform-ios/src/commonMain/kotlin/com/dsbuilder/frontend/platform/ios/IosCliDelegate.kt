package com.dsbuilder.frontend.platform.ios

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
 * Делегат платформы iOS: вызывает `dsbuilder-ios` — Swift CLI из репозитория plasma-ios.
 *
 * Инструмент принимает путь к `.sdds` и сам выводит из него имя темы, корень чекаута и
 * расположение сэмплов, поэтому делегату достаточно передать пути рабочей копии.
 */
public class IosCliDelegate internal constructor(
    private val processRunner: ProcessRunner,
    private val locator: IosToolchainLocator,
) : PlatformDelegate {
    override val toolchain: ToolchainId = ToolchainId("ios")

    /**
     * UIKit-компоненты живут в той же библиотеке и генерируются вместе со SwiftUI,
     * отдельной целевой платформы у них нет.
     */
    override val platforms: Set<TargetPlatform> = setOf(TargetPlatform.SWIFT_UI)

    /**
     * `DESIGN_SYSTEM` — генерация темы, затем компонентов: у инструмента нет общей команды,
     * поэтому делегат запускает обе по очереди и останавливается на первой неудаче.
     */
    override val capabilities: Set<Capability> =
        setOf(Capability.THEME, Capability.COMPONENTS, Capability.DOCS_AGGREGATE, Capability.DESIGN_SYSTEM)

    override fun doctor(workspace: WorkspacePaths, toolOverride: String?): ToolchainStatus {
        val executable = locator.locate(toolOverride) ?: return ToolchainStatus.Missing(missingHint(toolOverride))

        return when (val version = readVersion(executable, workspace)) {
            // Минимальная версия пока не проверяется: у инструмента одна опубликованная линия,
            // и отказ по версии сейчас только мешал бы работе с локальной сборкой.
            is VersionRead.Reported -> ToolchainStatus.Ready(executable = executable, version = version.value)
            is VersionRead.Unavailable -> ToolchainStatus.Missing(version.reason)
        }
    }

    private fun readVersion(executable: String, workspace: WorkspacePaths): VersionRead {
        val result = try {
            processRunner.run(
                ProcessRequest(
                    executable = executable,
                    args = listOf("--version"),
                    workingDirectory = workspace.workspaceDir,
                    inheritStdio = false,
                ),
            )
        } catch (error: ProcessLaunchException) {
            return VersionRead.Unavailable("$executable cannot be started: ${error.message}")
        }

        return if (result.exitCode == 0) {
            VersionRead.Reported(result.output.trim())
        } else {
            VersionRead.Unavailable("$executable --version failed with exit code ${result.exitCode}.")
        }
    }

    override fun run(invocation: DelegateInvocation): DelegateResult {
        val commands = commands(invocation)
        val executable = locator.locate(invocation.toolOverride)
            ?: return DelegateResult.ToolchainMissing(missingHint(invocation.toolOverride))

        return try {
            val failed = commands.firstNotNullOfOrNull { arguments ->
                processRunner.run(
                    ProcessRequest(
                        executable = executable,
                        args = arguments,
                        workingDirectory = invocation.workspace.workspaceDir,
                    ),
                ).exitCode.takeIf { it != 0 }
            }
            if (failed == null) {
                DelegateResult.Completed(summary = completedSummary(invocation))
            } else {
                DelegateResult.Failed(exitCode = failed, message = "see the output of $executable above")
            }
        } catch (error: ProcessLaunchException) {
            DelegateResult.ToolchainMissing("$executable cannot be started: ${error.message}")
        }
    }

    /** Запуски инструмента для capability по порядку; поддержаны все объявленные в [capabilities]. */
    private fun commands(invocation: DelegateInvocation): List<List<String>> = when (invocation.capability) {
        Capability.THEME -> listOf(generationArguments("theme", invocation))
        Capability.COMPONENTS -> listOf(generationArguments("components", invocation))
        Capability.DESIGN_SYSTEM -> listOf(
            generationArguments("theme", invocation),
            generationArguments("components", invocation),
        )
        Capability.DOCS_AGGREGATE -> listOf(docsArguments(invocation))
    }

    /**
     * `theme generate` и `components generate` принимают одинаковые аргументы: инструмент
     * разделяет их так же, как Gradle-плагин Android разделяет свои generate-таски.
     */
    private fun generationArguments(command: String, invocation: DelegateInvocation): List<String> = buildList {
        add(command)
        add("generate")
        add("--sdds")
        add(invocation.workspace.sddsDir)
        invocation.output?.let {
            add("--output")
            add(it)
        }
        addAll(invocation.passthrough)
    }

    private fun docsArguments(invocation: DelegateInvocation): List<String> = buildList {
        add("docs")
        add("aggregate")
        add("--sdds")
        add(invocation.workspace.sddsDir)
        invocation.output?.let {
            add("--output")
            add(it)
        }
        addAll(invocation.passthrough)
    }

    private fun completedSummary(invocation: DelegateInvocation): String = when (invocation.capability) {
        Capability.THEME -> "Theme generated from ${invocation.workspace.sddsDir}."
        Capability.COMPONENTS -> "Component variations generated from ${invocation.workspace.sddsDir}."
        Capability.DOCS_AGGREGATE -> "Documentation tree aggregated from ${invocation.workspace.sddsDir}."
        Capability.DESIGN_SYSTEM -> "Design system generated from ${invocation.workspace.sddsDir}."
    }

    /** Результат чтения версии инструмента. */
    private sealed interface VersionRead {
        data class Reported(val value: String) : VersionRead

        data class Unavailable(val reason: String) : VersionRead
    }

    /** Названный в `--tool` путь важнее списка стандартных мест: проверялся именно он. */
    private fun missingHint(toolOverride: String?): String = if (toolOverride != null) {
        "$IOS_TOOL_EXECUTABLE was not found at $toolOverride, the path given by --tool."
    } else {
        "$IOS_TOOL_EXECUTABLE was not found. Checked: ${locator.checkedLocations().joinToString()}. " +
            "Install it from the plasma-ios release or pass --tool <path>."
    }
}
