package com.dsbuilder.projects.feature.projects.presentation

import com.dsbuilder.projects.feature.projects.application.AccessKeyNotFoundException
import com.dsbuilder.projects.feature.projects.application.ForbiddenProjectActionException
import com.dsbuilder.projects.feature.projects.application.IdentityProviderUnavailableException
import com.dsbuilder.projects.feature.projects.application.InvalidProjectRequestException
import com.dsbuilder.projects.feature.projects.application.ProjectNotFoundException
import com.dsbuilder.projects.feature.projects.application.RegisteredIdentityUserNotFoundException
import com.dsbuilder.projects.feature.projects.domain.model.AccessKeyScope
import com.dsbuilder.projects.feature.projects.domain.model.ActorType
import com.dsbuilder.projects.feature.projects.domain.model.AuthenticatedActor
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKey
import com.dsbuilder.projects.feature.projects.domain.model.ProjectMember
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.application
import io.ktor.server.request.header
import io.ktor.server.response.respond
import kotlinx.serialization.Serializable

private const val USER_ID_HEADER = "X-User-Id"
private const val SYSTEM_ADMIN_HEADER = "X-System-Admin"
private const val INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key"
private const val ACTOR_TYPE_HEADER = "X-Actor-Type"
private const val PROJECT_ID_HEADER = "X-Project-Id"
private const val PROJECT_KEY_ID_HEADER = "X-Project-Key-Id"
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
internal data class CreateProjectAccessKeyRequest(
    val name: String,
    val scopes: List<String>,
    val ttlSeconds: Long? = null,
)

@Serializable
internal data class ProjectResponse(
    val id: String,
    val name: String,
    val description: String?,
    val status: String,
    val ownerUserId: String,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
internal data class ProjectMemberResponse(
    val userId: String,
    val role: String,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
internal data class ProjectAccessCheckResponse(
    val projectRole: String,
)

@Serializable
internal data class ProjectAccessKeyResponse(
    val id: String,
    val projectId: String,
    val name: String,
    val scopes: List<String>,
    val createdByUserId: String,
    val expiresAt: String?,
    val revokedAt: String?,
    val lastUsedAt: String?,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
internal data class CreatedProjectAccessKeyResponse(
    val key: ProjectAccessKeyResponse,
    val secret: String,
)

@Serializable
internal data class VerifyProjectAccessKeyRequest(
    val token: String,
)

@Serializable
internal data class VerifyProjectAccessKeyResponse(
    val projectId: String,
    val keyId: String,
    val scopes: List<String>,
)

@Serializable
internal data class ErrorResponse(
    val message: String,
    val code: String? = null,
)

internal fun Project.toResponse(): ProjectResponse =
    ProjectResponse(
        id = id,
        name = name,
        description = description,
        status = status.name.lowercase(),
        ownerUserId = ownerUserId,
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString(),
    )

internal fun ProjectMember.toResponse(): ProjectMemberResponse =
    ProjectMemberResponse(
        userId = userId,
        role = role.name.lowercase(),
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString(),
    )

internal fun ProjectAccessKey.toResponse(): ProjectAccessKeyResponse =
    ProjectAccessKeyResponse(
        id = id,
        projectId = projectId,
        name = name,
        scopes = scopes.map { it.value }.sorted(),
        createdByUserId = createdByUserId,
        expiresAt = expiresAt?.toString(),
        revokedAt = revokedAt?.toString(),
        lastUsedAt = lastUsedAt?.toString(),
        createdAt = createdAt.toString(),
        updatedAt = updatedAt.toString(),
    )

internal fun UpsertProjectMemberRequest.normalizedRole(): String = role.trim().uppercase()

internal fun UpdateProjectMemberRoleRequest.normalizedRole(): String = role.trim().uppercase()

internal fun CreateProjectAccessKeyRequest.normalizedScopes(): Set<AccessKeyScope> =
    scopes.map { rawScope ->
        AccessKeyScope.parse(rawScope)
            ?: throw InvalidProjectRequestException("Unsupported scope '$rawScope'")
    }.toSet()

internal fun ApplicationCall.requireActor(): AuthenticatedActor {
    val actorType = request.header(ACTOR_TYPE_HEADER)
        ?.let { rawValue -> ActorType.entries.firstOrNull { it.name.equals(rawValue, ignoreCase = true) } }
        ?: ActorType.USER
    val userId = request.header(USER_ID_HEADER)
        ?: throw InvalidProjectRequestException("Missing $USER_ID_HEADER header")
    val isSystemAdmin = request.header(SYSTEM_ADMIN_HEADER)?.toBooleanStrictOrNull() ?: false
    val projectScopes = request.header(PROJECT_SCOPES_HEADER)
        ?.split(',')
        ?.filter { it.isNotBlank() }
        ?.map { scope -> AccessKeyScope.parse(scope) ?: throw InvalidProjectRequestException("Invalid scope '$scope'") }
        ?.toSet()
        ?: emptySet()
    return AuthenticatedActor(
        type = actorType,
        userId = userId,
        isSystemAdmin = isSystemAdmin,
        projectId = request.header(PROJECT_ID_HEADER),
        projectKeyId = request.header(PROJECT_KEY_ID_HEADER),
        scopes = projectScopes,
    )
}

internal fun ApplicationCall.requireInternalAccess(expectedApiKey: String?) {
    if (expectedApiKey.isNullOrBlank()) {
        return
    }
    val actualApiKey = request.header(INTERNAL_API_KEY_HEADER)
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
