package com.dsbuilder.frontend.cli.feature.ds.presentation

import com.dsbuilder.frontend.cli.feature.components.presentation.render
import com.dsbuilder.frontend.cli.feature.theme.presentation.render
import com.dsbuilder.frontend.cli.presentation.targetPlatform
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.feature.components.application.ComponentDestination
import com.dsbuilder.frontend.feature.components.application.FetchComponentsCommand
import com.dsbuilder.frontend.feature.components.application.FetchComponentsResult
import com.dsbuilder.frontend.feature.components.application.FetchComponentsUseCase
import com.dsbuilder.frontend.feature.theme.application.FetchThemesCommand
import com.dsbuilder.frontend.feature.theme.application.FetchThemesResult
import com.dsbuilder.frontend.feature.theme.application.FetchThemesUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.help
import com.github.ajalt.clikt.parameters.options.option
import kotlinx.coroutines.runBlocking

/**
 * Presentation command для `dsbuilder ds fetch`: `theme fetch`, затем `components fetch`.
 *
 * Своего use case нет: загрузки принадлежат фичам `theme` и `components`, которые не зависят друг
 * от друга, а склеить два вызова может только presentation. Обе загрузки получают одни и те же опции
 * контекста и ключа; при отказе темы компоненты не загружаются.
 */
internal class DsFetchCliCommand(
    private val fetchThemesUseCase: FetchThemesUseCase,
    private val fetchComponentsUseCase: FetchComponentsUseCase,
) : CliktCommand(name = "fetch") {
    private val apiKey: String? by option("--api-key")
    private val apiUrl: String? by option("--api-url")
    private val designSystem: String? by option("--design-system")
    private val projectKeyEnv: String? by option("--project-key-env")
    private val platform: TargetPlatform? by option("--platform").targetPlatform()
        .help(
            "Target platform; taken from .sdds/config.json when omitted. " +
                "react also fetches the web adapter into .sdds/web/web-adapter.json.",
        )
    private val destination: String? by option("--destination")
        .help("Local directory for a new .sdds when using a design-system link (theme).")
    private val to: String? by option("--to")
        .help("Directory of the component package; required with a design-system link without local config.")

    override fun run() {
        val themes = runBlocking {
            fetchThemesUseCase.execute(
                FetchThemesCommand(
                    apiKeyOverride = apiKey,
                    apiUrlOverride = apiUrl,
                    designSystemUri = designSystem,
                    projectKeyEnvName = projectKeyEnv,
                    destinationDirectory = destination,
                ),
            )
        }
        when (themes) {
            is FetchThemesResult.Fetched -> echo(themes.render())
            is FetchThemesResult.Failed -> {
                echo(themes.message)
                throw ProgramResult(statusCode = 1)
            }
        }

        val components = runBlocking {
            fetchComponentsUseCase.execute(
                FetchComponentsCommand(
                    destination = ComponentDestination(directory = to),
                    apiKeyOverride = apiKey,
                    apiUrlOverride = apiUrl,
                    designSystemUri = designSystem,
                    projectKeyEnvName = projectKeyEnv,
                    platform = platform,
                ),
            )
        }
        echo("")
        components.source?.let { echo(it.render()) }
        when (components) {
            is FetchComponentsResult.Fetched -> echo(components.render())
            is FetchComponentsResult.Failed -> {
                echo(components.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String =
        "Fetch the theme and the component configurations of the design system: theme fetch, then components fetch."
}
