package com.dsbuilder.frontend.cli.feature.components.presentation

import com.dsbuilder.frontend.cli.presentation.PLATFORM_OPTION_HELP
import com.dsbuilder.frontend.cli.presentation.echoPlan
import com.dsbuilder.frontend.cli.presentation.echoResult
import com.dsbuilder.frontend.cli.presentation.targetPlatform
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.feature.components.application.GenerateComponentsCommand
import com.dsbuilder.frontend.feature.components.application.GenerateComponentsUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.parameters.arguments.argument
import com.github.ajalt.clikt.parameters.arguments.multiple
import com.github.ajalt.clikt.parameters.options.help
import com.github.ajalt.clikt.parameters.options.option

/**
 * Presentation command для `dsbuilder components generate`.
 */
internal class ComponentsGenerateCliCommand(
    private val generateComponentsUseCase: GenerateComponentsUseCase,
) : CliktCommand(name = "generate") {
    private val platform: TargetPlatform? by option("--platform").targetPlatform().help(PLATFORM_OPTION_HELP)

    private val output: String? by option("--output")
        .help("Directory for the generated components; the platform tool decides when omitted.")

    private val tool: String? by option("--tool")
        .help("Path to the platform tool; overrides toolchain discovery.")

    private val passthrough: List<String> by argument("[-- <tool args>]")
        .multiple()

    override fun run() {
        val result = generateComponentsUseCase.execute(
            GenerateComponentsCommand(
                platform = platform,
                output = output,
                passthrough = passthrough,
                toolOverride = tool,
            ),
            onPlan = ::echoPlan,
        )

        echoResult(result)
    }

    override fun help(context: Context): String = "Generate component code with the platform tool."
}
