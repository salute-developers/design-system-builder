package com.dsbuilder.frontend.cli.feature.init.data

import com.dsbuilder.frontend.cli.core.config.CredentialReference
import com.dsbuilder.frontend.cli.core.config.CredentialReferenceType
import com.dsbuilder.frontend.cli.core.config.ProjectConfig
import com.dsbuilder.frontend.cli.core.config.ProjectConfigException
import com.dsbuilder.frontend.cli.core.config.ProjectConfigStore
import com.dsbuilder.frontend.cli.feature.init.application.CreateProjectConfigCommand
import com.dsbuilder.frontend.cli.feature.init.application.ProjectConfigWriteResult
import com.dsbuilder.frontend.cli.feature.init.application.ProjectConfigWriter

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
                ),
            )
            ProjectConfigWriteResult.Created(configPath = configPath)
        } catch (exception: ProjectConfigException) {
            ProjectConfigWriteResult.Failed(message = "Error: ${exception.message}")
        }
}
