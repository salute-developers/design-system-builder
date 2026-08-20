package com.dsbuilder.frontend.cli.feature.status.presentation

import com.dsbuilder.frontend.cli.feature.status.application.CheckProjectStatusCommand
import com.dsbuilder.frontend.cli.feature.status.application.CheckProjectStatusResult
import com.dsbuilder.frontend.cli.feature.status.application.CheckProjectStatusUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.option

/**
 * Presentation command для `dsbuilder status`.
 */
internal class StatusCliCommand(
    private val checkProjectStatusUseCase: CheckProjectStatusUseCase,
) : CliktCommand(name = "status") {
    private val apiKey: String? by option("--api-key")

    private val apiUrl: String? by option("--api-url")

    override fun run() {
        val result = checkProjectStatusUseCase.execute(
            CheckProjectStatusCommand(
                apiKeyOverride = apiKey,
                apiUrlOverride = apiUrl,
            ),
        )

        when (result) {
            is CheckProjectStatusResult.Authorized -> echo(
                """
                    Project: ${result.projectName}
                    Design system: ${result.designSystemName}
                    Config: ${result.configPath}
                    API: ${result.apiUrl}
                    Status: authorized
                """.trimIndent(),
            )
            is CheckProjectStatusResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String = "Verify access to the configured project."
}
