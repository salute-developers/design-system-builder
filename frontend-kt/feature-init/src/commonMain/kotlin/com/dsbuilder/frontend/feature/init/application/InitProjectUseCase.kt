package com.dsbuilder.frontend.feature.init.application

import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectConfigDraft
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.domain.TargetPlatform

/**
 * Use case для создания локального project config командой `dsbuilder init`.
 */
public class InitProjectUseCase internal constructor(
    private val projectConfigWriter: ProjectConfigWriter,
) {
    /**
     * Создает `.sdds/config.json` с project metadata и env credential reference.
     */
    public fun execute(command: InitProjectCommand): InitProjectResult {
        val result = projectConfigWriter.create(
            CreateProjectConfigCommand(
                config = ProjectConfigDraft(
                    projectId = ProjectId(command.projectId),
                    designSystemId = DesignSystemId(command.designSystemId),
                    credentialEnvName = CredentialEnvName(command.apiKeyEnv),
                    platforms = command.platforms,
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
 * Command model для [InitProjectUseCase].
 *
 * @property projectId идентификатор DS Builder project.
 * @property designSystemId идентификатор design system внутри project.
 * @property apiKeyEnv имя env-переменной с project API key.
 * @property targetDirectory директория, где создается `.sdds/config.json`.
 * @property platforms целевые платформы проекта из `--platform`; пустой список — платформа не объявлена.
 */
public data class InitProjectCommand(
    public val projectId: String,
    public val designSystemId: String,
    public val apiKeyEnv: String,
    public val targetDirectory: String,
    public val platforms: List<TargetPlatform> = emptyList(),
)

/**
 * Результат инициализации локального project config.
 */
public sealed interface InitProjectResult {
    /**
     * Config был создан.
     *
     * @property configPath путь созданного `.sdds/config.json`.
     */
    public data class Created(
        public val configPath: String,
    ) : InitProjectResult

    /**
     * Config не был создан.
     *
     * @property message user-facing ошибка.
     */
    public data class Failed(
        public val message: String,
    ) : InitProjectResult
}
