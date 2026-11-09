package com.dsbuilder.projects.feature.projects.application.usecase

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.projects.feature.projects.application.ForbiddenProjectActionException
import com.dsbuilder.projects.feature.projects.application.InvalidProjectRequestException
import com.dsbuilder.projects.feature.projects.domain.model.ActorType
import com.dsbuilder.projects.feature.projects.domain.model.AuthenticatedActor
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectEntity
import com.dsbuilder.projects.feature.projects.domain.model.ProjectMember
import com.dsbuilder.projects.feature.projects.domain.model.ProjectRole
import com.dsbuilder.projects.feature.projects.domain.model.ProjectStatus
import com.dsbuilder.projects.feature.projects.domain.model.TokenAction
import com.dsbuilder.projects.feature.projects.domain.model.TokenScope

internal class ProjectAccessPolicy(
    private val evaluator: PolicyEvaluator = PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()),
) {
    fun resolveRole(
        actor: AuthenticatedActor,
        project: Project,
        membership: ProjectMember?,
    ): ProjectRole? =
        when {
            actor.isSystemAdmin -> ProjectRole.OWNER
            actor.userId == project.ownerUserId -> ProjectRole.OWNER
            membership != null -> membership.role
            else -> null
        }

    fun requireProjectAccess(
        actor: AuthenticatedActor,
        project: Project,
        membership: ProjectMember?,
    ): ProjectRole =
        resolveRole(actor, project, membership)
            ?.also {
                val wrongProject = actor.projectId != null && actor.projectId != project.id
                val invalidPat = actor.personalAccessTokenId.isNullOrBlank() || wrongProject
                if (actor.type == ActorType.PERSONAL_ACCESS_TOKEN && invalidPat) {
                    throw ForbiddenProjectActionException("Invalid personal access token context")
                }
            }
            ?: throw ForbiddenProjectActionException("Project access denied")

    fun requireMetadataUpdate(role: ProjectRole) {
        if (!role.isAllowed(PROJECT_UPDATE_METADATA)) {
            throw ForbiddenProjectActionException("Only owner or maintainer can update project metadata")
        }
    }

    fun requireProjectMutationAccess(actor: AuthenticatedActor) {
        if (actor.type != ActorType.USER) {
            throw ForbiddenProjectActionException("Personal access tokens cannot modify project metadata or lifecycle")
        }
    }

    fun requireArchive(role: ProjectRole) {
        if (!role.isAllowed(PROJECT_ARCHIVE)) {
            throw ForbiddenProjectActionException("Only owner can archive or restore project")
        }
    }

    fun requireMemberManagement(
        actorRole: ProjectRole,
        targetUserId: String,
        project: Project,
        permission: MemberManagementPermission,
        actor: AuthenticatedActor? = null,
    ) {
        val failureMessage = when {
            actor != null && actor.type != ActorType.USER -> "Personal access tokens cannot manage project members"
            targetUserId == project.ownerUserId -> "Owner cannot be managed through project members"
            !actorRole.isAllowed(permission.value, actor?.isSystemAdmin == true) ->
                "Only owner or maintainer can manage project members"
            else -> null
        }
        if (failureMessage != null) {
            throw ForbiddenProjectActionException(failureMessage)
        }
    }

    fun requireMutableProject(project: Project) {
        if (project.status == ProjectStatus.ARCHIVED) {
            throw ForbiddenProjectActionException("Archived project cannot be modified")
        }
    }

    fun validateProjectName(name: String) {
        if (name.isBlank()) {
            throw InvalidProjectRequestException("Project name must not be blank")
        }
    }

    fun validateManageableRole(role: ProjectRole) {
        if (role == ProjectRole.OWNER) {
            throw InvalidProjectRequestException("Owner role is not allowed in project members")
        }
    }

    fun requireTokenScope(
        actor: AuthenticatedActor,
        entity: ProjectEntity,
        action: TokenAction,
    ) {
        val permission = "${entity.configValue}:${action.name.lowercase()}"
        if (actor.type != ActorType.USER && permission !in actor.scopes.map(TokenScope::value)) {
            throw ForbiddenProjectActionException(
                "Personal access token does not have ${entity.configValue}:${action.name.lowercase()} scope",
            )
        }
    }

    private fun ProjectRole.isAllowed(permission: String, systemAdmin: Boolean = false): Boolean = evaluator.isAllowed(
        ProjectPrincipal(
            type = ProjectActorType.USER,
            actorId = "project-policy",
            projectId = "project-policy",
            projectRole = name.lowercase(),
            systemAdmin = systemAdmin,
        ),
        permission,
    )

    private companion object {
        const val PROJECT_UPDATE_METADATA = "project:update_metadata"
        const val PROJECT_ARCHIVE = "project:archive"
    }
}

internal enum class MemberManagementPermission(val value: String) {
    ADD("members:add"),
    CHANGE_ROLE("members:change_role"),
    REMOVE("members:remove"),
}
