package com.dsbuilder.projects.feature.projects.application.usecase

import com.dsbuilder.projects.feature.projects.application.ForbiddenProjectActionException
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorization
import com.dsbuilder.projects.feature.projects.application.VerifiedProjectKey

internal class DefaultProjectAuthorization(
    private val roles: GetEffectiveProjectRoleUseCase,
    private val keys: VerifyProjectAccessKeyUseCase,
) : ProjectAuthorization {
    override suspend fun role(userId: String, projectId: String, systemAdmin: Boolean): String? =
        roles.execute(GetEffectiveRoleInput(userId, projectId, systemAdmin))?.name?.lowercase()

    override suspend fun verify(token: String): VerifiedProjectKey? = try {
        val key = keys.execute(VerifyProjectAccessKeyInput(token))
        VerifiedProjectKey(key.keyId, key.projectId, key.scopes.map { it.value }.toSet())
    } catch (_: ForbiddenProjectActionException) {
        null
    }
}
