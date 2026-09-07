package com.dsbuilder.frontend.cli.presentation

import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.platform.PlatformRunPlan
import com.dsbuilder.frontend.core.platform.PlatformRunResult
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.NullableOption
import com.github.ajalt.clikt.parameters.options.RawOption
import com.github.ajalt.clikt.parameters.types.choice

/** Общий help `--platform`, чтобы словарь платформ не расходился между командами. */
internal const val PLATFORM_OPTION_HELP: String = "Target platform; taken from .sdds/config.json when omitted."

/**
 * Превращает `--platform` в доменное значение: словарь один на все команды, ошибка ввода — от Clikt.
 */
internal fun RawOption.targetPlatform(): NullableOption<TargetPlatform, TargetPlatform> =
    choice(TargetPlatform.entries.associateBy { it.cliValue })

/**
 * Печатает, что и чем запускается, до старта инструмента.
 */
internal fun CliktCommand.echoPlan(plan: PlatformRunPlan) {
    echo(
        """
            Platform: ${plan.platform.cliValue}
            Toolchain: ${plan.toolchain}
            Workspace: ${plan.workspace.workspaceDir}
        """.trimIndent(),
    )
}

/**
 * Печатает итог делегирования и завершает команду ненулевым кодом при ошибке.
 */
internal fun CliktCommand.echoResult(result: PlatformRunResult) {
    when (result) {
        is PlatformRunResult.Completed -> echo(result.summary)
        is PlatformRunResult.Failed -> {
            echo(result.message)
            throw ProgramResult(statusCode = 1)
        }
    }
}
