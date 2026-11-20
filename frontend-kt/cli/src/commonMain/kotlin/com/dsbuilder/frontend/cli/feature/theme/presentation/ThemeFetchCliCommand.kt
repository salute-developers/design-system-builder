package com.dsbuilder.frontend.cli.feature.theme.presentation

import com.dsbuilder.frontend.cli.presentation.AnalyticsCliCommand
import com.dsbuilder.frontend.feature.theme.application.FetchThemesCommand
import com.dsbuilder.frontend.feature.theme.application.FetchThemesResult
import com.dsbuilder.frontend.feature.theme.application.FetchThemesUseCase
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.option
import kotlinx.coroutines.runBlocking

/**
 * Presentation command для `dsbuilder theme fetch`.
 */
internal class ThemeFetchCliCommand(
    private val fetchThemesUseCase: FetchThemesUseCase,
) : AnalyticsCliCommand(name = "fetch", operation = "theme fetch") {
    private val apiKey: String? by option("--api-key")

    private val designSystem: String? by option("--design-system")
    private val destination: String? by option(
        "--destination",
        help = "Local directory for a new .sdds when using a design-system link.",
    )

    override fun runOperation() {
        val result = runBlocking {
            fetchThemesUseCase.execute(
                FetchThemesCommand(
                    apiKeyOverride = apiKey,
                    apiUrlOverride = null,
                    designSystemUri = designSystem,
                    destinationDirectory = destination,
                ),
            )
        }

        when (result) {
            is FetchThemesResult.Fetched -> echo(result.render())
            is FetchThemesResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String = "Fetch themes into local .sdds files."
}

/** Печатает результат загрузки тем; общий для `theme fetch` и `ds fetch`. */
internal fun FetchThemesResult.Fetched.render(): String = """
    Tenants: $tenantCount
    Files: $fileCount
    Config: $configPath
    Status: themes fetched
""".trimIndent()
