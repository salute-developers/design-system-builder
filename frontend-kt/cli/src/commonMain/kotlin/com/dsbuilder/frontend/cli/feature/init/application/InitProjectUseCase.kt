package com.dsbuilder.frontend.cli.feature.init.application

import com.dsbuilder.frontend.cli.core.domain.CredentialEnvName
import com.dsbuilder.frontend.cli.core.domain.DesignSystemId
import com.dsbuilder.frontend.cli.core.domain.ProjectConfigDraft
import com.dsbuilder.frontend.cli.core.domain.ProjectId

/**
 * Use case для создания локального project config командой `dsbuilder init`.
 */
internal class InitProjectUseCase(
    private val projectConfigWriter: ProjectConfigWriter,
) {
    /**
     * Создает `.sdds/config.json` с project metadata и env credential reference.
     */
    internal fun execute(command: InitProjectCommand): InitProjectResult {
        val result = projectConfigWriter.create(
            CreateProjectConfigCommand(
                config = ProjectConfigDraft(
                    projectId = ProjectId(command.projectId),
                    designSystemId = DesignSystemId(command.designSystemId),
                    credentialEnvName = CredentialEnvName(command.apiKeyEnv),
                ),
                targetDirectory = command.targetDirectory,
            ),
        )

        return when (result) {
            is ProjectConfigWriteResult.Created -> InitProjectResult.Created(result.configPath)
            is ProjectConfigWriteResult.Failed -> InitProjectResult.Failed(result.message)
        }
    }
}

/**
 * Command model для `InitProjectUseCase`.
 *
 * @property projectId идентификатор DS Builder project.
 * @property designSystemId идентификатор design system внутри project.
 * @property apiKeyEnv имя env-переменной с project API key.
 * @property targetDirectory директория, где создается `.sdds/config.json`.
 */
internal data class InitProjectCommand(
    val projectId: String,
    val designSystemId: String,
    val apiKeyEnv: String,
    val targetDirectory: String,
)

/**
 * Результат инициализации локального project config.
 */
internal sealed interface InitProjectResult {
    /**
     * Config был создан.
     *
     * @property configPath путь созданного `.sdds/config.json`.
     */
    data class Created(
        val configPath: String,
    ) : InitProjectResult

    /**
     * Config не был создан.
     *
     * @property message user-facing ошибка.
     */
    data class Failed(
        val message: String,
    ) : InitProjectResult
}
