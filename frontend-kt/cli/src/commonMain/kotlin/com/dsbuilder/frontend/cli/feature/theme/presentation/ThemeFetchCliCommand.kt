package com.dsbuilder.frontend.cli.feature.theme.presentation

import com.dsbuilder.frontend.feature.theme.application.FetchThemesCommand
import com.dsbuilder.frontend.feature.theme.application.FetchThemesResult
import com.dsbuilder.frontend.feature.theme.application.FetchThemesUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.option

/**
 * Presentation command для `dsbuilder theme fetch`.
 */
internal class ThemeFetchCliCommand(
    private val fetchThemesUseCase: FetchThemesUseCase,
) : CliktCommand(name = "fetch") {
    private val apiKey: String? by option("--api-key")

    private val apiUrl: String? by option("--api-url")

    override fun run() {
        val result = fetchThemesUseCase.execute(
            FetchThemesCommand(
                apiKeyOverride = apiKey,
                apiUrlOverride = apiUrl,
            ),
        )

        when (result) {
            is FetchThemesResult.Fetched -> echo(
                """
                    Tenants: ${result.tenantCount}
                    Files: ${result.fileCount}
                    Config: ${result.configPath}
                    Status: themes fetched
                """.trimIndent(),
            )
            is FetchThemesResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String = "Fetch themes into local .sdds files."
}
