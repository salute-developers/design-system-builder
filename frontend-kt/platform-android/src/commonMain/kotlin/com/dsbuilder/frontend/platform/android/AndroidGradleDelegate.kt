package com.dsbuilder.frontend.platform.android

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
 * Делегат платформы Android: вызывает `gradlew` проекта пользователя, в котором применён
 * Gradle-плагин `dsBuilder` (`sdds-core/plugin_theme_builder` из репозитория plasma-android).
 *
 * В отличие от iOS, инструмент — не отдельный бинарь, а Gradle-таска внутри проекта пользователя:
 * делегату нужно только найти `gradlew` и запустить его с `-p <workspaceDir>` и именем нужной
 * таски. Какая именно платформа (Compose, View) вообще сконфигурирована в модуле, решает
 * build.gradle.kts самого модуля — задача делегата только выбрать имя таски и запустить её.
 *
 * Все три capability (`THEME`, `COMPONENTS`, `DOCS_AGGREGATE`) используют пер-платформенные таски
 * (`generateComposeTheme`/`generateViewTheme`, `generateComposeComponents`/`generateViewComponents`,
 * `aggregateComposeDocumentation`/`aggregateViewDocumentation`): если платформа не сконфигурирована,
 * соответствующей таски не существует, и Gradle сам сообщает об этом понятной ошибкой вместо тихой
 * генерации/агрегации не той платформы.
 */
public class AndroidGradleDelegate internal constructor(
    private val processRunner: ProcessRunner,
    private val locator: AndroidGradleLocator,
) : PlatformDelegate {
    override val toolchain: ToolchainId = ToolchainId("android")

    override val platforms: Set<TargetPlatform> = setOf(TargetPlatform.COMPOSE, TargetPlatform.ANDROID_VIEW)

    override val capabilities: Set<Capability> =
        setOf(Capability.THEME, Capability.COMPONENTS, Capability.DOCS_AGGREGATE)

    override fun doctor(workspace: WorkspacePaths, toolOverride: String?): ToolchainStatus {
        val gradlew = locator.locate(workspace.workspaceDir, toolOverride)
            ?: return ToolchainStatus.Missing(missingHint(workspace, toolOverride))

        return try {
            val ready = DOCTOR_TASKS.any { task -> helpTaskSucceeds(gradlew, workspace, task) }
            if (ready) {
                // У Android нет отдельного бинаря — версия таска-инструмента отсутствует так же,
                // как отсутствует сам бинарь; сообщать версию Gradle было бы вводящим в заблуждение.
                ToolchainStatus.Ready(executable = gradlew, version = "")
            } else {
                ToolchainStatus.Missing(
                    "$gradlew does not recognize ${DOCTOR_TASKS.joinToString(" or ")} in " +
                        "${workspace.workspaceDir}. Apply the dsBuilder Gradle plugin (plasma-android) and " +
                        "configure at least one target platform.",
                )
            }
        } catch (error: ProcessLaunchException) {
            ToolchainStatus.Missing("$gradlew cannot be started: ${error.message}")
        }
    }

    override fun run(invocation: DelegateInvocation): DelegateResult {
        unsupportedResult(invocation)?.let { return it }

        val task = TASK_NAMES.getValue(invocation.capability to invocation.platform)
        val workspace = invocation.workspace
        val gradlew = locator.locate(workspace.workspaceDir, invocation.toolOverride)
            ?: return DelegateResult.ToolchainMissing(missingHint(workspace, invocation.toolOverride))

        return runGradleTask(gradlew, workspace, task, invocation.passthrough)
    }

    /** `null`, если invocation можно выполнить; иначе объясняет, почему нет — не запуская процесс. */
    private fun unsupportedResult(invocation: DelegateInvocation): DelegateResult.Unsupported? = when {
        invocation.output != null -> DelegateResult.Unsupported(
            "Android output location is configured in the module's build.gradle.kts " +
                "(dsBuilder.theme/components.outputLocation), not via --output.",
        )

        (invocation.capability to invocation.platform) !in TASK_NAMES -> DelegateResult.Unsupported(
            "Toolchain 'android' does not support ${invocation.capability.label} " +
                "for platform '${invocation.platform.cliValue}'.",
        )

        else -> null
    }

    private fun runGradleTask(
        gradlew: String,
        workspace: WorkspacePaths,
        task: String,
        passthrough: List<String>,
    ): DelegateResult = try {
        val result = processRunner.run(
            ProcessRequest(
                executable = gradlew,
                args = listOf("-p", workspace.workspaceDir, task) + passthrough,
                workingDirectory = workspace.workspaceDir,
            ),
        )
        if (result.exitCode == 0) {
            DelegateResult.Completed(summary = "$task completed for ${workspace.workspaceDir}.")
        } else {
            DelegateResult.Failed(exitCode = result.exitCode, message = "see the output of $gradlew above")
        }
    } catch (error: ProcessLaunchException) {
        DelegateResult.ToolchainMissing("$gradlew cannot be started: ${error.message}")
    }

    private fun helpTaskSucceeds(gradlew: String, workspace: WorkspacePaths, task: String): Boolean {
        val result = processRunner.run(
            ProcessRequest(
                executable = gradlew,
                args = listOf("-p", workspace.workspaceDir, "help", "--task", task),
                workingDirectory = workspace.workspaceDir,
                inheritStdio = false,
            ),
        )
        return result.exitCode == 0
    }

    private fun missingHint(workspace: WorkspacePaths, toolOverride: String?): String = if (toolOverride != null) {
        "$GRADLEW_EXECUTABLE was not found at $toolOverride, the path given by --tool."
    } else {
        "$GRADLEW_EXECUTABLE was not found ascending from ${workspace.workspaceDir}. " +
            "Make sure the workspace is inside a Gradle project, or pass --tool <path to gradlew>."
    }

    private companion object {
        /**
         * Gradle-таска для `(capability, platform)`. Каждая пара ведёт на свою пер-платформенную
         * таску, зарегистрированную `dsBuilder`-плагином только когда модуль конфигурирует эту
         * платформу — запрос платформы, которую модуль не настраивал, честно возвращает "task not
         * found" вместо тихой генерации/агрегации не той платформы (см. KDoc класса).
         */
        val TASK_NAMES: Map<Pair<Capability, TargetPlatform>, String> = mapOf(
            (Capability.THEME to TargetPlatform.COMPOSE) to "generateComposeTheme",
            (Capability.THEME to TargetPlatform.ANDROID_VIEW) to "generateViewTheme",
            (Capability.COMPONENTS to TargetPlatform.COMPOSE) to "generateComposeComponents",
            (Capability.COMPONENTS to TargetPlatform.ANDROID_VIEW) to "generateViewComponents",
            (Capability.DOCS_AGGREGATE to TargetPlatform.COMPOSE) to "aggregateComposeDocumentation",
            (Capability.DOCS_AGGREGATE to TargetPlatform.ANDROID_VIEW) to "aggregateViewDocumentation",
        )

        /** `doctor` не получает capability/platform — проверяет обе THEME-таски, готовность значит «хотя бы одна». */
        val DOCTOR_TASKS: List<String> = listOf("generateComposeTheme", "generateViewTheme")
    }
}
