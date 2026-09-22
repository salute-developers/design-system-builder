package com.dsbuilder.monolith.integration

import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerificationResult
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerifier
import com.dsbuilder.identity.auth.application.port.ProjectActorContext
import com.dsbuilder.identity.auth.application.port.ProjectContextResolution
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.application.port.ResolvedProjectContext
import com.dsbuilder.projects.feature.projects.application.ProjectAccessKeyAuthorizationResult
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorizationRequest
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorizationResult
import com.dsbuilder.projects.feature.projects.application.ProjectAuthorizationService

/** Адаптирует in-process Projects authorization contract к Identity project context port. */
class InProcessProjectContextResolver(
    private val authorizationService: ProjectAuthorizationService,
) : ProjectContextResolver {
    override suspend fun resolve(
        actor: ProjectActorContext,
        projectId: String,
    ): ProjectContextResolution =
        when (
            val result = authorizationService.resolveProjectContext(
                ProjectAuthorizationRequest(actor.userId, projectId, actor.isSystemAdmin),
            )
        ) {
            is ProjectAuthorizationResult.Allowed -> ProjectContextResolution.Allowed(
                ResolvedProjectContext(result.projectId, result.projectRole),
            )
            ProjectAuthorizationResult.Denied -> ProjectContextResolution.Denied
            ProjectAuthorizationResult.Unavailable -> ProjectContextResolution.Unavailable
        }
}

/** Адаптирует in-process Projects access-key contract к Identity verification port. */
class InProcessProjectAccessKeyVerifier(
    private val authorizationService: ProjectAuthorizationService,
) : ProjectAccessKeyVerifier {
    override suspend fun verify(token: String): ProjectAccessKeyVerificationResult =
        when (val result = authorizationService.verifyAccessKey(token)) {
            is ProjectAccessKeyAuthorizationResult.Valid -> ProjectAccessKeyVerificationResult.Valid(
                keyId = result.keyId,
                projectId = result.projectId,
                scopes = result.scopes,
            )
            ProjectAccessKeyAuthorizationResult.Invalid -> ProjectAccessKeyVerificationResult.Invalid
            ProjectAccessKeyAuthorizationResult.Unavailable -> ProjectAccessKeyVerificationResult.Unavailable
        }
}
