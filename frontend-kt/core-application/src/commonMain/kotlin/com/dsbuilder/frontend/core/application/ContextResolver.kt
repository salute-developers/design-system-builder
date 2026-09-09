package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.domain.ProjectContext
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
) {
    /**
     * Resolves the first available context from the configured source chain.
     */
    public fun resolve(startingDirectory: String? = null): ProjectContextReadResult {
        for (source in sources) {
            when (val result = source.resolve(startingDirectory)) {
                is ContextSourceResult.Failed -> return ProjectContextReadResult.Failed(result.message, result.reason)
                is ContextSourceResult.Found -> return ProjectContextReadResult.Found(result.context)
                ContextSourceResult.NotFound -> Unit
            }
        }
        return ProjectContextReadResult.Failed("Error: project context was not found.")
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
            ContextSourceResult.Failed("Error: ${exception.message}", ProjectContextFailure.NOT_INITIALIZED)
        } catch (exception: ProjectConfigException) {
            ContextSourceResult.Failed("Error: ${exception.message}", ProjectContextFailure.INVALID)
        } catch (exception: UnknownTargetPlatformException) {
            ContextSourceResult.Failed("Error: ${exception.message}")
        }
}
