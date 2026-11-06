package com.dsbuilder.projects.feature.projects.application.usecase

import com.dsbuilder.projects.feature.projects.application.ProjectAuthorization

internal class DefaultProjectAuthorization(
    private val roles: GetEffectiveProjectRoleUseCase,
) : ProjectAuthorization {
    override suspend fun role(userId: String, projectId: String, systemAdmin: Boolean): String? =
        roles.execute(GetEffectiveRoleInput(userId, projectId, systemAdmin))?.name?.lowercase()
}
