package com.dsbuilder.frontend.cli.feature.init.presentation

import com.dsbuilder.frontend.cli.presentation.targetPlatform
import com.dsbuilder.frontend.core.auth.DEFAULT_API_KEY_ENV
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.init.application.InitProjectCommand
import com.dsbuilder.frontend.feature.init.application.InitProjectResult
import com.dsbuilder.frontend.feature.init.application.InitProjectUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.parameters.options.default
import com.github.ajalt.clikt.parameters.options.help
import com.github.ajalt.clikt.parameters.options.multiple
import com.github.ajalt.clikt.parameters.options.option
import com.github.ajalt.clikt.parameters.options.required

/**
 * Presentation command для `dsbuilder init`.
 */
internal class InitCliCommand(
    private val initProjectUseCase: InitProjectUseCase,
    private val fileSystem: WorkspaceFileSystem,
) : CliktCommand(name = "init") {
    private val projectId: String by option("--project-id").required()

    private val designSystemId: String by option("--design-system-id").required()

    private val apiKeyEnv: String by option("--api-key-env").default(DEFAULT_API_KEY_ENV)

    private val platforms: List<TargetPlatform> by option("--platform").targetPlatform().multiple()
        .help("Target platform of the project; repeat the option for several platforms.")

    override fun run() {
        when (
            val result = initProjectUseCase.execute(
                InitProjectCommand(
                    projectId = projectId,
                    designSystemId = designSystemId,
                    apiKeyEnv = apiKeyEnv,
                    targetDirectory = fileSystem.currentWorkingDirectory(),
                    platforms = platforms,
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
