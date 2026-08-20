package com.dsbuilder.frontend.cli.core.data

import com.dsbuilder.frontend.cli.core.application.ProjectContextReadResult
import com.dsbuilder.frontend.cli.core.application.ProjectContextReader
import com.dsbuilder.frontend.cli.core.config.ProjectConfigException
import com.dsbuilder.frontend.cli.core.config.ProjectConfigStore
import com.dsbuilder.frontend.cli.core.domain.CredentialEnvName
import com.dsbuilder.frontend.cli.core.domain.DesignSystemId
import com.dsbuilder.frontend.cli.core.domain.ProjectContext
import com.dsbuilder.frontend.cli.core.domain.ProjectId

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
