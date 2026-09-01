package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.workspace.ProjectConfigException
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore

/**
 * Adapter чтения project context из nearest-parent `.sdds/config.json`.
 */
internal class LocalProjectContextReader(
    private val projectConfigStore: ProjectConfigStore,
) : ProjectContextReader {
    override fun requireContext(): ProjectContextReadResult =
        try {
            val context = projectConfigStore.requireNearestContext()
            ProjectContextReadResult.Found(
                ProjectContext(
                    projectId = ProjectId(context.config.projectId),
                    designSystemId = DesignSystemId(context.config.designSystemId),
                    credentialEnvName = CredentialEnvName(context.config.credential.name),
                    configPath = context.configPath,
                ),
            )
        } catch (exception: ProjectConfigException) {
            ProjectContextReadResult.Failed("Error: ${exception.message}")
        }
}
