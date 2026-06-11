package com.dsbuilder.identity.auth.application.port

import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor
import com.dsbuilder.identity.auth.domain.model.ProjectContext

internal interface ProjectContextResolver {
    suspend fun resolve(actor: AuthenticatedActor, projectId: String): ProjectContextResolution
}

internal sealed interface ProjectContextResolution {
    data class Allowed(val context: ProjectContext) : ProjectContextResolution
    data object Denied : ProjectContextResolution
    data object Unavailable : ProjectContextResolution
}
