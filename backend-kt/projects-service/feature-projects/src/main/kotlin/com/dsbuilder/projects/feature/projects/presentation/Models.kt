package com.dsbuilder.projects.feature.projects.presentation

import com.dsbuilder.projects.feature.projects.application.AccessKeyNotFoundException
import com.dsbuilder.projects.feature.projects.application.ForbiddenProjectActionException
import com.dsbuilder.projects.feature.projects.application.IdentityProviderUnavailableException
import com.dsbuilder.projects.feature.projects.application.InvalidProjectRequestException
import com.dsbuilder.projects.feature.projects.application.ProjectNotFoundException
import com.dsbuilder.projects.feature.projects.application.RegisteredIdentityUserNotFoundException
import com.dsbuilder.projects.feature.projects.application.port.IdentityUser
import com.dsbuilder.projects.feature.projects.domain.model.ActorType
import com.dsbuilder.projects.feature.projects.domain.model.AuthenticatedActor
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectMember
import com.dsbuilder.projects.feature.projects.domain.model.ProjectRole
import com.dsbuilder.projects.feature.projects.domain.model.TokenScope
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.application
import io.ktor.server.response.respond
import kotlinx.serialization.Serializable

private const val USER_ID_HEADER = "X-User-Id"
private const val SYSTEM_ADMIN_HEADER = "X-System-Admin"
private const val INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key"
private const val ACTOR_TYPE_HEADER = "X-Actor-Type"
private const val PROJECT_ID_HEADER = "X-Project-Id"
private const val PROJECT_SCOPES_HEADER = "X-Project-Scopes"

@Serializable
internal data class CreateProjectRequest(
    val name: String,
    val description: String? = null,
)

@Serializable
internal data class UpdateProjectRequest(
    val name: String? = null,
    val description: String? = null,
)

@Serializable
internal data class UpsertProjectMemberRequest(
    val email: String,
    val role: String,
)

@Serializable
internal data class UpdateProjectMemberRoleRequest(
    val role: String,
)

@Serializable
internal data class ProjectResponse(
    val id: String,
    val name: String,
    val description: String?,
    val status: String,
    val ownerUserId: String,
    val ownerUsername: String? = null,
    val ownerEmail: String? = null,
    val ownerDisplayName: String? = null,
    val effectiveRole: String? = null,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
internal data class ProjectMemberResponse(
    val userId: String,
    val username: String? = null,
    val email: String? = null,
    val displayName: String? = null,
    val role: String,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
internal data class ProjectMemberCandidateResponse(
    val userId: String,
    val username: String?,
    val email: String,
    val displayName: String?,
)

@Serializable
internal data class ProjectAccessCheckResponse(
    val projectRole: String,
)

@Serializable
internal data class ErrorResponse(
    val message: String,
    val code: String? = null,
)

internal fun Project.toResponse(
    effectiveRole: ProjectRole? = null,
    ownerIdentity: IdentityUser? = null,
): ProjectResponse =
    ProjectResponse(
        id = id,
        name = name,
        description = description,
        status = status.name.lowercase(),
        ownerUserId = ownerUserId,
        ownerUsername = ownerIdentity?.username,
        ownerEmail = ownerIdentity?.email,
        ownerDisplayName = ownerIdentity?.displayName,
        effectiveRole = effectiveRole?.name?.lowercase(),
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString(),
    )

internal fun ProjectMember.toResponse(identity: IdentityUser? = null): ProjectMemberResponse =
    ProjectMemberResponse(
        userId = userId,
        username = identity?.username,
        email = identity?.email,
        displayName = identity?.displayName,
        role = role.name.lowercase(),
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString(),
    )

internal fun IdentityUser.toCandidateResponse(): ProjectMemberCandidateResponse =
    ProjectMemberCandidateResponse(
        userId = userId,
        username = username,
        email = email,
        displayName = displayName,
    )

internal fun UpsertProjectMemberRequest.normalizedRole(): String = role.trim().uppercase()

internal fun UpdateProjectMemberRoleRequest.normalizedRole(): String = role.trim().uppercase()

internal fun ApplicationCall.requireActor(): AuthenticatedActor {
    val actorType = parseActorType(projectsTrustedHeaders()[ACTOR_TYPE_HEADER] ?: "user")
    val userId = projectsTrustedHeaders()[USER_ID_HEADER]
        ?: throw InvalidProjectRequestException("Missing $USER_ID_HEADER header")
    val isSystemAdmin = projectsTrustedHeaders()[SYSTEM_ADMIN_HEADER]?.toBooleanStrictOrNull() ?: false
    val projectScopes = projectsTrustedHeaders()[PROJECT_SCOPES_HEADER]
        ?.split(',')
        ?.filter { it.isNotBlank() }
        ?.map { scope -> TokenScope.parse(scope) ?: throw InvalidProjectRequestException("Invalid scope '$scope'") }
        ?.toSet()
        ?: emptySet()
    return AuthenticatedActor(
        type = actorType,
        userId = userId,
        isSystemAdmin = isSystemAdmin,
        projectId = projectsTrustedHeaders()[PROJECT_ID_HEADER],
        personalAccessTokenId = projectsTrustedHeaders()["X-Personal-Access-Token-Id"],
        scopes = projectScopes,
    )
}

internal fun ApplicationCall.requireInternalAccess(expectedApiKey: String?) {
    if (expectedApiKey.isNullOrBlank()) {
        return
    }
    val actualApiKey = projectsTrustedHeaders()[INTERNAL_API_KEY_HEADER]
    if (actualApiKey != expectedApiKey) {
        throw ForbiddenProjectActionException("Invalid internal API key")
    }
}

internal suspend fun ApplicationCall.respondProjectError(error: Throwable) {
    application.environment.log.error("Projects request failed", error)
    when (error) {
        is InvalidProjectRequestException -> respond(HttpStatusCode.BadRequest, ErrorResponse(error.message.orEmpty()))
        is ForbiddenProjectActionException -> respond(HttpStatusCode.Forbidden, ErrorResponse(error.message.orEmpty()))
        is ProjectNotFoundException -> respond(HttpStatusCode.NotFound, ErrorResponse(error.message.orEmpty()))
        is AccessKeyNotFoundException -> respond(HttpStatusCode.NotFound, ErrorResponse(error.message.orEmpty()))
        is RegisteredIdentityUserNotFoundException -> respond(
            HttpStatusCode.NotFound,
            ErrorResponse(error.message.orEmpty(), code = "registered_user_not_found"),
        )
        is IdentityProviderUnavailableException -> respond(
            HttpStatusCode.ServiceUnavailable,
            ErrorResponse(error.message.orEmpty(), code = "identity_provider_unavailable"),
        )
        else -> respond(HttpStatusCode.InternalServerError, ErrorResponse("Internal server error"))
    }
}

private fun parseActorType(value: String): ActorType =
    ActorType.entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
        ?: throw InvalidProjectRequestException("Invalid actor type")
