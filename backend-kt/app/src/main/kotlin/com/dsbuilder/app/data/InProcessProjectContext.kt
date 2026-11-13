package com.dsbuilder.app.data

import com.dsbuilder.identity.auth.application.port.ProjectContextResolution
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor
import com.dsbuilder.identity.auth.domain.model.ProjectContext
import com.dsbuilder.identity.auth.domain.model.ProjectRole
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorization
import kotlinx.coroutines.CancellationException

/** Адаптер контекста проекта без внутреннего HTTP и доступа к таблицам. */
class InProcessProjectContext(private val projects: ProjectAuthorization) : ProjectContextResolver {
    override suspend fun resolve(actor: AuthenticatedActor, projectId: String): ProjectContextResolution = try {
        val role = projects.role(actor.userId, projectId, actor.isSystemAdmin)
        if (role == null) {
            ProjectContextResolution.Denied
        } else {
            ProjectContextResolution.Allowed(ProjectContext(projectId, ProjectRole.valueOf(role.uppercase())))
        }
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        ProjectContextResolution.Unavailable
    }
}
