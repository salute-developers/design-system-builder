package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.workspace.ProjectConfigException
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.core.workspace.ProjectNotInitializedException

/**
 * Adapter чтения project context из nearest-parent `.sdds/config.json`.
 */
internal class LocalProjectContextReader(
    private val projectConfigStore: ProjectConfigStore,
) : ProjectContextReader {
    override fun requireContext(): ProjectContextReadResult =
        try {
            val context = projectConfigStore.requireNearestContext()
            val platforms = context.config.platforms.map { value ->
                TargetPlatform.fromCliValue(value)
                    ?: return ProjectContextReadResult.Failed(unknownPlatformMessage(value, context.configPath))
            }
            ProjectContextReadResult.Found(
                ProjectContext(
                    projectId = ProjectId(context.config.projectId),
                    designSystemId = DesignSystemId(context.config.designSystemId),
                    credentialEnvName = CredentialEnvName(context.config.credential.name),
                    configPath = context.configPath,
                    platforms = platforms,
                ),
            )
        } catch (exception: ProjectNotInitializedException) {
            ProjectContextReadResult.Failed("Error: ${exception.message}", ProjectContextFailure.NOT_INITIALIZED)
        } catch (exception: ProjectConfigException) {
            ProjectContextReadResult.Failed("Error: ${exception.message}", ProjectContextFailure.INVALID)
        }

    private fun unknownPlatformMessage(value: String, configPath: String): String =
        "Error: unknown platform '$value' in $configPath. " +
            "Supported platforms: ${TargetPlatform.cliValues.joinToString()}."
}
