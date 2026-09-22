package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.domain.ContextProvenance
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.workspace.ProjectConfigException
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.core.workspace.ProjectNotInitializedException

/**
 * One project-context source in the shared resolver chain.
 */
public fun interface ContextSource {
    /**
     * Resolves project context from the optional starting directory.
     */
    public fun resolve(startingDirectory: String?): ContextSourceResult
}

/**
 * Source-level context resolution result.
 */
public sealed interface ContextSourceResult {
    /**
     * Context was found by this source.
     *
     * @property context resolved project context.
     */
    public data class Found(
        public val context: ProjectContext,
    ) : ContextSourceResult

    /**
     * This source has no matching context.
     */
    public data object NotFound : ContextSourceResult

    /**
     * This source failed while resolving context.
     *
     * @property message user-facing failure message.
     * @property reason stable category used by commands that can tolerate a missing project only.
     */
    public data class Failed(
        public val message: String,
        public val reason: ProjectContextFailure = ProjectContextFailure.INVALID,
    ) : ContextSourceResult
}

/**
 * Shared CLI/MCP context resolver.
 */
public class ContextResolver(
    private val sources: List<ContextSource>,
    private val projectEnvironmentLoader: ProjectEnvironmentLoader? = null,
) {
    /** Resolves a typed context request without mutating any process-wide selection. */
    public fun resolve(request: ContextRequest): ProjectContextReadResult =
        resolve(request.startingDirectory, request.designSystemUri, request.projectKeyEnvName)

    /**
     * Resolves the first available context from the configured source chain.
     */
    @Suppress("ReturnCount")
    public fun resolve(
        startingDirectory: String? = null,
        designSystemUri: String? = null,
        projectKeyEnvName: String? = null,
    ): ProjectContextReadResult {
        if (projectKeyEnvName != null && designSystemUri == null) {
            return ProjectContextReadResult.Failed(
                "--project-key-env requires --design-system.",
                ProjectContextFailure.INVALID_CONTEXT,
            )
        }
        if (designSystemUri != null) {
            val selection = DesignSystemLink.parse(designSystemUri)
                ?: return ProjectContextReadResult.Failed(
                    "Invalid design-system link.", ProjectContextFailure.INVALID_CONTEXT,
                )
            if (projectKeyEnvName != null && !projectKeyEnvName.matches(Regex("[A-Za-z_][A-Za-z0-9_]*"))) {
                return ProjectContextReadResult.Failed(
                    "Invalid project-key env name.",
                    ProjectContextFailure.INVALID_CONTEXT,
                )
            }
            return ProjectContextReadResult.Found(
                ProjectContext(
                    projectId = ProjectId(selection.projectId.value),
                    designSystemId = DesignSystemId(selection.designSystemId.value),
                    credentialEnvName = CredentialEnvName(projectKeyEnvName ?: "DSBUILDER_API_KEY"),
                    configPath = "",
                    platforms = listOf(selection.platform),
                    credentialPolicy = if (projectKeyEnvName == null) {
                        CredentialPolicy.USER_SESSION
                    } else {
                        CredentialPolicy.PROJECT_KEY_ENV
                    },
                    provenance = ContextProvenance.EXPLICIT_LINK,
                    selectedVersion = selection.version,
                ),
            )
        }
        for (source in sources) {
            when (val result = source.resolve(startingDirectory)) {
                is ContextSourceResult.Failed -> return ProjectContextReadResult.Failed(result.message, result.reason)
                is ContextSourceResult.Found -> return withProjectEnvironment(result.context)
                ContextSourceResult.NotFound -> Unit
            }
        }
        return ProjectContextReadResult.Failed(
            "Error: Design-system context is required. Pass --design-system " +
                "'dsbuilder://projects/<project-id>/design-systems/<design-system-id>" +
                "?version=<version>&platform=<platform>', or run " +
                "`dsbuilder init --project-id <id> --design-system-id <id>`.",
            ProjectContextFailure.NOT_INITIALIZED,
        )
    }

    private fun withProjectEnvironment(context: ProjectContext): ProjectContextReadResult {
        val environment = try {
            context.configPath.takeIf { it.isNotBlank() }
                ?.let { projectEnvironmentLoader?.load(it) }
        } catch (error: ProjectEnvironmentException) {
            return ProjectContextReadResult.Failed("Error: ${error.message}")
        }
        return ProjectContextReadResult.Found(context, environment)
    }
}

/**
 * Nearest-parent `.sdds/config.json` source retained as the current context source.
 */
internal class NearestProjectConfigContextSource(
    private val projectConfigStore: ProjectConfigStore,
) : ContextSource {
    override fun resolve(startingDirectory: String?): ContextSourceResult =
        try {
            val context = if (startingDirectory.isNullOrBlank()) {
                projectConfigStore.requireNearestContext()
            } else {
                projectConfigStore.requireNearestContext(startingDirectory)
            }
            ContextSourceResult.Found(context.toProjectContext())
        } catch (exception: ProjectNotInitializedException) {
            ContextSourceResult.NotFound
        } catch (exception: ProjectConfigException) {
            ContextSourceResult.Failed("Error: ${exception.message}", ProjectContextFailure.INVALID)
        } catch (exception: UnknownTargetPlatformException) {
            ContextSourceResult.Failed("Error: ${exception.message}")
        }
}
