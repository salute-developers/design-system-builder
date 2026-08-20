package com.dsbuilder.identity.auth.application.usecase

import com.dsbuilder.identity.auth.application.port.JwtVerificationResult
import com.dsbuilder.identity.auth.application.port.JwtVerifier
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerificationResult
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerifier
import com.dsbuilder.identity.auth.application.port.ProjectContextResolution
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.domain.model.ActorType
import com.dsbuilder.identity.auth.domain.model.ProjectContext
import com.dsbuilder.identity.auth.domain.model.ProjectRole
import com.dsbuilder.identity.auth.domain.model.TrustedHeaders

internal class AuthorizeProjectRequestUseCase(
    private val jwtVerifier: JwtVerifier,
    private val projectContextResolver: ProjectContextResolver,
    private val projectAccessKeyVerifier: ProjectAccessKeyVerifier,
) {
    suspend fun execute(input: GatewayAuthInput): GatewayAuthDecision {
        val authorizationHeader = input.authorizationHeader
            ?: return GatewayAuthDecision.Unauthorized("Missing authorization header")

        val bearerToken = authorizationHeader.extractBearerToken()
        return if (bearerToken != null) {
            when (val verified = jwtVerifier.verify(bearerToken)) {
                is JwtVerificationResult.Invalid -> verified.reason.toDecision()
                is JwtVerificationResult.Valid -> authorizeActor(verified.actor, input.projectId)
            }
        } else {
            authorizeProjectKey(authorizationHeader.extractProjectAccessKeyToken(), input.projectId)
        }
    }

    private suspend fun authorizeActor(
        actor: com.dsbuilder.identity.auth.domain.model.AuthenticatedActor,
        projectId: String,
    ): GatewayAuthDecision {
        val context = if (actor.isSystemAdmin) {
            ProjectContext(projectId = projectId, projectRole = ProjectRole.OWNER)
        } else {
            when (val resolution = projectContextResolver.resolve(actor, projectId)) {
                is ProjectContextResolution.Allowed -> resolution.context
                ProjectContextResolution.Denied -> return GatewayAuthDecision.Forbidden("Project access denied")
                ProjectContextResolution.Unavailable -> return GatewayAuthDecision.Forbidden(
                    "Project access unavailable",
                )
            }
        }

        return GatewayAuthDecision.Allowed(
            TrustedHeaders(
                actorType = actor.type.headerValue,
                userId = actor.userId,
                projectId = context.projectId,
                projectRole = context.projectRole.headerValue,
                systemAdmin = actor.isSystemAdmin.toString(),
            ),
        )
    }

    private suspend fun authorizeProjectKey(
        token: String?,
        projectId: String,
    ): GatewayAuthDecision {
        val accessKeyToken = token ?: return GatewayAuthDecision.Unauthorized("Missing project access key")
        return when (val verified = projectAccessKeyVerifier.verify(accessKeyToken)) {
            is ProjectAccessKeyVerificationResult.Valid -> {
                if (verified.projectId != projectId) {
                    GatewayAuthDecision.Forbidden("Project access denied")
                } else {
                    GatewayAuthDecision.Allowed(
                        TrustedHeaders(
                            actorType = ActorType.PROJECT_KEY.headerValue,
                            userId = verified.keyId,
                            projectId = verified.projectId,
                            projectRole = null,
                            projectKeyId = verified.keyId,
                            projectScopes = verified.scopes.sorted().joinToString(","),
                            systemAdmin = false.toString(),
                        ),
                    )
                }
            }
            ProjectAccessKeyVerificationResult.Invalid -> {
                GatewayAuthDecision.Unauthorized("Invalid project access key")
            }
            ProjectAccessKeyVerificationResult.Unavailable -> {
                GatewayAuthDecision.Forbidden("Project access unavailable")
            }
        }
    }
}

internal data class GatewayAuthInput(
    val authorizationHeader: String?,
    val projectId: String,
)

internal sealed interface GatewayAuthDecision {
    data class Allowed(val trustedHeaders: TrustedHeaders) : GatewayAuthDecision
    data class Unauthorized(val reason: String) : GatewayAuthDecision
    data class Forbidden(val reason: String) : GatewayAuthDecision
}

internal fun String.extractProjectAccessKeyToken(): String? {
    val trimmed = trim()
    if (trimmed.isBlank()) {
        return null
    }
    val parts = trimmed.split(" ", limit = 2)
    return when {
        parts.size == 1 -> parts[0]
        parts[0].equals("ProjectKey", ignoreCase = true) && parts[1].isNotBlank() -> parts[1]
        else -> null
    }
}
