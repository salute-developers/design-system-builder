package com.dsbuilder.frontend.cli.feature.ds.presentation

import com.dsbuilder.frontend.cli.presentation.PLATFORM_OPTION_HELP
import com.dsbuilder.frontend.cli.presentation.echoResult
import com.dsbuilder.frontend.cli.presentation.printPlan
import com.dsbuilder.frontend.cli.presentation.targetPlatform
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.feature.ds.application.GenerateDesignSystemCommand
import com.dsbuilder.frontend.feature.ds.application.GenerateDesignSystemUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.parameters.arguments.argument
import com.github.ajalt.clikt.parameters.arguments.multiple
import com.github.ajalt.clikt.parameters.options.help
import com.github.ajalt.clikt.parameters.options.option

/**
 * Presentation command для `dsbuilder ds generate`.
 */
internal class DsGenerateCliCommand(
    private val generateDesignSystemUseCase: GenerateDesignSystemUseCase,
) : CliktCommand(name = "generate") {
    private val platform: TargetPlatform? by option("--platform").targetPlatform().help(PLATFORM_OPTION_HELP)

    private val output: String? by option("--output")
        .help("Directory for the generated design system; the platform tool decides when omitted.")

    private val tool: String? by option("--tool")
        .help("Path to the platform tool; overrides toolchain discovery.")

    private val passthrough: List<String> by argument("[-- <tool args>]")
        .multiple()

    override fun run() {
        val result = generateDesignSystemUseCase.execute(
            GenerateDesignSystemCommand(
                platform = platform,
                output = output,
                passthrough = passthrough,
                toolOverride = tool,
            ),
            onPlan = ::printPlan,
        )

        echoResult(result)
    }

    override fun help(context: Context): String =
        "Generate the theme and components together with the platform tool in one run."
}
