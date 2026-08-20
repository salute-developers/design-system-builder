package com.dsbuilder.frontend.cli.feature.init.presentation

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.credentials.DEFAULT_API_KEY_ENV
import com.dsbuilder.frontend.cli.feature.init.application.InitProjectCommand
import com.dsbuilder.frontend.cli.feature.init.application.InitProjectResult
import com.dsbuilder.frontend.cli.feature.init.application.InitProjectUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.default
import com.github.ajalt.clikt.parameters.options.option
import com.github.ajalt.clikt.parameters.options.required

/**
 * Presentation command для `dsbuilder init`.
 */
internal class InitCliCommand(
    private val initProjectUseCase: InitProjectUseCase,
    private val fileSystem: CliFileSystem,
) : CliktCommand(name = "init") {
    private val projectId: String by option("--project-id").required()

    private val designSystemId: String by option("--design-system-id").required()

    private val apiKeyEnv: String by option("--api-key-env").default(DEFAULT_API_KEY_ENV)

    override fun run() {
        when (
            val result = initProjectUseCase.execute(
                InitProjectCommand(
                    projectId = projectId,
                    designSystemId = designSystemId,
                    apiKeyEnv = apiKeyEnv,
                    targetDirectory = fileSystem.currentWorkingDirectory(),
                ),
            )
        ) {
            is InitProjectResult.Created -> echo("Project initialized at ${result.configPath}.")
            is InitProjectResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String = "Create local project config."
}
