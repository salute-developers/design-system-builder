package com.dsbuilder.frontend.cli.feature.init.presentation

import com.dsbuilder.frontend.cli.presentation.targetPlatform
import com.dsbuilder.frontend.core.auth.DEFAULT_API_KEY_ENV
import com.dsbuilder.frontend.core.domain.InitCredentialSelection
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadResult
import com.dsbuilder.frontend.feature.ds.application.ListDesignSystemsUseCase
import com.dsbuilder.frontend.feature.init.application.InitProjectCommand
import com.dsbuilder.frontend.feature.init.application.InitProjectResult
import com.dsbuilder.frontend.feature.init.application.InitProjectUseCase
import com.dsbuilder.frontend.feature.projects.application.ListProjectsUseCase
import com.dsbuilder.frontend.feature.projects.application.ProjectsReadResult
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.ProgramResult
import com.github.ajalt.clikt.core.terminal
import com.github.ajalt.clikt.parameters.options.help
import com.github.ajalt.clikt.parameters.options.multiple
import com.github.ajalt.clikt.parameters.options.option
import kotlinx.coroutines.runBlocking

/** Последовательный выбор проекта, системы и платформ либо совместимый явный режим. */
internal class InitCliCommand(
    private val initProjectUseCase: InitProjectUseCase,
    private val fileSystem: WorkspaceFileSystem,
    private val projects: ListProjectsUseCase,
    private val systems: ListDesignSystemsUseCase,
    private val menu: InitSelectionMenu,
) : CliktCommand(name = "init") {
    private val projectId: String? by option("--project-id")
    private val designSystemId: String? by option("--design-system-id")
    private val apiKeyEnv: String? by option("--api-key-env")
    private val platforms: List<TargetPlatform> by option("--platform").targetPlatform().multiple()
        .help("Target platform of the project; repeat the option for several platforms.")

    override fun run() {
        val directory = fileSystem.currentWorkingDirectory()
        initProjectUseCase.checkTarget(directory)?.let { fail(it) }
        val interactive = projectId == null || designSystemId == null
        if (interactive && !menu.supported(terminal)) {
            val missing = listOfNotNull(
                if (projectId == null) "--project-id" else null,
                if (designSystemId == null) "--design-system-id" else null,
            )
            fail("Error: interactive selection is unavailable; provide ${missing.joinToString(" and ")}.")
        }
        val (project, system) = if (interactive) runBlocking { discover() } else projectId!! to designSystemId!!
        val selectedPlatforms = platformsFor(interactive)
        val credential = if (interactive && apiKeyEnv == null) {
            InitCredentialSelection.UserSession
        } else {
            InitCredentialSelection.Environment(apiKeyEnv ?: DEFAULT_API_KEY_ENV)
        }
        when (
            val result = initProjectUseCase.execute(
                InitProjectCommand(
                    project,
                    system,
                    apiKeyEnv ?: DEFAULT_API_KEY_ENV,
                    directory,
                    selectedPlatforms,
                    credential,
                ),
            )
        ) {
            is InitProjectResult.Created -> echo("Project initialized at ${result.configPath}.")
            is InitProjectResult.Failed -> fail(result.message)
        }
    }

    private suspend fun discover(): Pair<String, String> {
        val project = projectId ?: when (val result = projects.execute()) {
            is ProjectsReadResult.Failed -> fail(result.message)
            is ProjectsReadResult.Success -> choose(
                "Выберите проект",
                result.projects.map {
                    InitChoice(it.id, it.name, it.description)
                },
            )
        }
        val available = when (val result = systems.execute(project)) {
            is DesignSystemsReadResult.Failed -> fail(result.message)
            is DesignSystemsReadResult.Success -> result.items
        }
        val system = designSystemId?.also { explicit ->
            if (available.none { it.id == explicit }) {
                fail("Error: design system does not belong to the selected project.")
            }
        } ?: choose(
            "Выберите дизайн-систему проекта $project",
            available.map {
                InitChoice(it.id, it.name, it.description)
            },
        )
        return project to system
    }

    private fun choose(title: String, choices: List<InitChoice>): String {
        if (choices.isEmpty()) fail("Error: no available choices. $title.")
        val selected = try {
            menu.select(terminal, title, choices)
        } catch (_: UnsupportedOperationException) {
            fail("Error: interactive selection is unavailable; provide --project-id and --design-system-id.")
        } catch (_: IllegalStateException) {
            fail("Error: selection cancelled or terminal input closed.")
        }
        if (selected == null) fail("Error: selection cancelled or terminal input closed.")
        if (choices.none { it.id == selected }) fail("Error: invalid selection.")
        return selected
    }

    private fun choosePlatforms(): List<TargetPlatform> {
        val choices = TargetPlatform.entries.map { platform ->
            InitChoice(platform.cliValue, platform.cliValue, null)
        }
        val selected = try {
            menu.selectMultiple(terminal, "Выберите платформы (можно пропустить)", choices)
        } catch (_: UnsupportedOperationException) {
            fail("Error: interactive platform selection is unavailable; provide --platform.")
        } catch (_: IllegalStateException) {
            fail("Error: selection cancelled or terminal input closed.")
        } ?: fail("Error: selection cancelled or terminal input closed.")
        if (selected.size != selected.distinct().size) fail("Error: invalid platform selection.")
        return selected.map { id ->
            TargetPlatform.fromCliValue(id) ?: fail("Error: invalid platform selection.")
        }
    }

    private fun platformsFor(interactive: Boolean): List<TargetPlatform> =
        if (interactive && platforms.isEmpty()) choosePlatforms() else platforms

    private fun fail(message: String): Nothing {
        echo(message)
        throw ProgramResult(1)
    }

    override fun help(context: Context): String =
        "Create local project config. Omit IDs for arrow-key selection after dsbuilder auth login. " +
            "Use Space to mark platforms and Enter to continue; --platform skips that step. " +
            "Explicit IDs work offline; --api-key-env selects an environment credential."
}
