package com.dsbuilder.frontend.cli.feature.docs.presentation

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.docs.application.DocsInitCommand
import com.dsbuilder.frontend.feature.docs.application.DocsInitResult
import com.dsbuilder.frontend.feature.docs.application.DocsInitUseCase
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult

/**
 * CLI command для `dsbuilder docs init`.
 *
 * Создаёт базовую структуру docs/ с structure.json в целевой директории.
 */
internal class DocsInitCliCommand(
    private val initUseCase: DocsInitUseCase,
    private val fileSystem: WorkspaceFileSystem,
) : CliktCommand(name = "init") {

    override fun run() {
        val currentDir = fileSystem.currentWorkingDirectory()

        val result = initUseCase.execute(DocsInitCommand(targetDirectory = currentDir))

        when (result) {
            is DocsInitResult.Created -> {
                echo("Docs structure created at ${result.configPath}.")
            }
            is DocsInitResult.Failed -> {
                echo(result.message)
                throw ProgramResult(statusCode = 1)
            }
        }
    }

    override fun help(context: Context): String = "Create initial docs/ structure with structure.json."
}
