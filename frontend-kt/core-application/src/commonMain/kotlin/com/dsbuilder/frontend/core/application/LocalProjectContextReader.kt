package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.workspace.CredentialReferenceType
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.core.workspace.ProjectContext as WorkspaceProjectContext

/**
 * Adapter чтения project context из nearest-parent `.sdds/config.json`.
 */
internal class LocalProjectContextReader(
    private val contextResolver: ContextResolver,
) : ProjectContextReader {
    constructor(projectConfigStore: ProjectConfigStore) : this(
        ContextResolver(listOf(NearestProjectConfigContextSource(projectConfigStore))),
    )

    override fun requireContext(startingDirectory: String?): ProjectContextReadResult =
        contextResolver.resolve(startingDirectory)

    override fun requireContext(request: ContextRequest): ProjectContextReadResult =
        contextResolver.resolve(request.startingDirectory, request.designSystemUri, request.projectKeyEnvName)
}

internal fun WorkspaceProjectContext.toProjectContext(): ProjectContext =
    ProjectContext(
        projectId = ProjectId(config.projectId),
        designSystemId = DesignSystemId(config.designSystemId),
        credentialEnvName = CredentialEnvName(config.credential.name),
        configPath = configPath,
        credentialPolicy = when (config.credential.type) {
            CredentialReferenceType.ENV, CredentialReferenceType.AUTO -> CredentialPolicy.AUTO
            CredentialReferenceType.USER_SESSION -> CredentialPolicy.USER_SESSION
            CredentialReferenceType.PROJECT_KEY_ENV -> CredentialPolicy.PROJECT_KEY_ENV
        },
        platforms = config.platforms.map { value ->
            com.dsbuilder.frontend.core.domain.TargetPlatform.fromCliValue(value)
                ?: throw UnknownTargetPlatformException(value, configPath)
        },
    )

internal class UnknownTargetPlatformException(
    value: String,
    configPath: String,
) : IllegalArgumentException(
    "unknown platform '$value' in $configPath. Supported platforms: " +
        com.dsbuilder.frontend.core.domain.TargetPlatform.cliValues.joinToString() + ".",
)
