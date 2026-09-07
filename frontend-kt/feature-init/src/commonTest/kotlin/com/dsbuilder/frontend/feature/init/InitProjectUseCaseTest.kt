package com.dsbuilder.frontend.feature.init

import com.dsbuilder.frontend.feature.init.application.CreateProjectConfigCommand
import com.dsbuilder.frontend.feature.init.application.InitProjectCommand
import com.dsbuilder.frontend.feature.init.application.InitProjectResult
import com.dsbuilder.frontend.feature.init.application.InitProjectUseCase
import com.dsbuilder.frontend.feature.init.application.ProjectConfigWriteResult
import com.dsbuilder.frontend.feature.init.application.ProjectConfigWriter
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/**
 * Characterization-тесты на текущее поведение [InitProjectUseCase]: сохраняются перед переносом
 * в отдельный Gradle-модуль `feature-init`, чтобы перенос был проверяем автоматически.
 */
class InitProjectUseCaseTest {
    @Test
    fun mapsCreatedResultAndCommandFields() {
        var receivedCommand: CreateProjectConfigCommand? = null
        val writer = ProjectConfigWriter { command ->
            receivedCommand = command
            ProjectConfigWriteResult.Created(configPath = "/work/.sdds/config.json")
        }
        val useCase = InitProjectUseCase(writer)

        val result = useCase.execute(
            InitProjectCommand(
                projectId = "project-1",
                designSystemId = "ds-1",
                apiKeyEnv = "DSBUILDER_API_KEY",
                targetDirectory = "/work",
            ),
        )

        assertIs<InitProjectResult.Created>(result)
        assertEquals("/work/.sdds/config.json", result.configPath)

        val command = receivedCommand
        assertIs<CreateProjectConfigCommand>(command)
        assertEquals("project-1", command.config.projectId.value)
        assertEquals("ds-1", command.config.designSystemId.value)
        assertEquals("DSBUILDER_API_KEY", command.config.credentialEnvName.value)
        assertEquals("/work", command.targetDirectory)
    }

    @Test
    fun mapsFailedResult() {
        val writer = ProjectConfigWriter {
            ProjectConfigWriteResult.Failed(
                message = "Error: Project config already exists at /work/.sdds/config.json.",
            )
        }
        val useCase = InitProjectUseCase(writer)

        val result = useCase.execute(
            InitProjectCommand(
                projectId = "project-1",
                designSystemId = "ds-1",
                apiKeyEnv = "DSBUILDER_API_KEY",
                targetDirectory = "/work",
            ),
        )

        assertIs<InitProjectResult.Failed>(result)
        assertEquals("Error: Project config already exists at /work/.sdds/config.json.", result.message)
    }
}
