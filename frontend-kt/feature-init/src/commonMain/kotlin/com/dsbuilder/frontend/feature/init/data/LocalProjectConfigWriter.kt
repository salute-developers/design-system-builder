package com.dsbuilder.frontend.feature.init.data

import com.dsbuilder.frontend.core.domain.InitCredentialSelection
import com.dsbuilder.frontend.core.workspace.CredentialReference
import com.dsbuilder.frontend.core.workspace.CredentialReferenceType
import com.dsbuilder.frontend.core.workspace.ProjectConfig
import com.dsbuilder.frontend.core.workspace.ProjectConfigException
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.feature.init.application.CreateProjectConfigCommand
import com.dsbuilder.frontend.feature.init.application.ProjectConfigWriteResult
import com.dsbuilder.frontend.feature.init.application.ProjectConfigWriter

/**
 * Adapter записи project config в `.sdds/config.json`.
 */
internal class LocalProjectConfigWriter(
    private val projectConfigStore: ProjectConfigStore,
) : ProjectConfigWriter {
    override fun checkTarget(targetDirectory: String): String? =
        if (projectConfigStore.configExists(targetDirectory)) "Error: Project config already exists." else null

    override fun create(command: CreateProjectConfigCommand): ProjectConfigWriteResult =
        try {
            val configPath = projectConfigStore.createConfig(
                targetDirectory = command.targetDirectory,
                config = ProjectConfig(
                    projectId = command.config.projectId.value,
                    designSystemId = command.config.designSystemId.value,
                    credential = CredentialReference(
                        type = when (command.config.credentialSelection) {
                            is InitCredentialSelection.Environment -> CredentialReferenceType.ENV
                            InitCredentialSelection.UserSession -> CredentialReferenceType.USER_SESSION
                        },
                        name = (command.config.credentialSelection as? InitCredentialSelection.Environment)?.name
                            ?: "DSBUILDER_API_KEY",
                    ),
                    platforms = command.config.platforms.map { it.cliValue },
                ),
            )
            ProjectConfigWriteResult.Created(configPath = configPath)
        } catch (exception: ProjectConfigException) {
            ProjectConfigWriteResult.Failed(message = "Error: ${exception.message}")
        }
}
