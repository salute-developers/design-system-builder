package com.dsbuilder.frontend.feature.init.data

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
    override fun create(command: CreateProjectConfigCommand): ProjectConfigWriteResult =
        try {
            val configPath = projectConfigStore.createConfig(
                targetDirectory = command.targetDirectory,
                config = ProjectConfig(
                    projectId = command.config.projectId.value,
                    designSystemId = command.config.designSystemId.value,
                    credential = CredentialReference(
                        type = CredentialReferenceType.ENV,
                        name = command.config.credentialEnvName.value,
                    ),
                    platforms = command.config.platforms.map { it.cliValue },
                ),
            )
            ProjectConfigWriteResult.Created(configPath = configPath)
        } catch (exception: ProjectConfigException) {
            ProjectConfigWriteResult.Failed(message = "Error: ${exception.message}")
        }
}
