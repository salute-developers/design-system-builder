package com.dsbuilder.projects.feature.projects.application.usecase

import com.dsbuilder.projects.feature.projects.application.ForbiddenProjectActionException
import com.dsbuilder.projects.feature.projects.application.InvalidProjectRequestException
import com.dsbuilder.projects.feature.projects.domain.model.AccessKeyAction
import com.dsbuilder.projects.feature.projects.domain.model.AccessKeyScope
import com.dsbuilder.projects.feature.projects.domain.model.ActorType
import com.dsbuilder.projects.feature.projects.domain.model.AuthenticatedActor
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKey
import com.dsbuilder.projects.feature.projects.domain.model.ProjectEntity
import com.dsbuilder.projects.feature.projects.domain.model.ProjectMember
import com.dsbuilder.projects.feature.projects.domain.model.ProjectRole
import com.dsbuilder.projects.feature.projects.domain.model.ProjectStatus
import java.time.Instant

internal class ProjectAccessPolicy {
    fun resolveRole(
        actor: AuthenticatedActor,
        project: Project,
        membership: ProjectMember?,
    ): ProjectRole? =
        when {
            actor.type == ActorType.PROJECT_KEY &&
                actor.projectId == project.id &&
                actor.hasScope(ProjectEntity.PROJECTS, AccessKeyAction.READ) ->
                ProjectRole.VIEWER
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
            ?: throw ForbiddenProjectActionException("Project access denied")

    fun requireMetadataUpdate(role: ProjectRole) {
        if (role != ProjectRole.OWNER && role != ProjectRole.MAINTAINER) {
            throw ForbiddenProjectActionException("Only owner or maintainer can update project metadata")
        }
    }

    fun requireProjectMutationAccess(actor: AuthenticatedActor) {
        if (actor.type == ActorType.PROJECT_KEY) {
            throw ForbiddenProjectActionException("Project keys cannot modify project metadata or lifecycle")
        }
    }

    fun requireArchive(role: ProjectRole) {
        if (role != ProjectRole.OWNER) {
            throw ForbiddenProjectActionException("Only owner can archive or restore project")
        }
    }

    fun requireMemberManagement(
        actorRole: ProjectRole,
        targetUserId: String,
        project: Project,
        actor: AuthenticatedActor? = null,
    ) {
        val failureMessage = when {
            actor?.type == ActorType.PROJECT_KEY -> "Project keys cannot manage project members"
            targetUserId == project.ownerUserId -> "Owner cannot be managed through project members"
            actorRole != ProjectRole.OWNER && actorRole != ProjectRole.MAINTAINER ->
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

    fun requireAccessKeyManagement(actor: AuthenticatedActor, role: ProjectRole) {
        if (actor.type == ActorType.PROJECT_KEY) {
            throw ForbiddenProjectActionException("Project keys cannot manage access keys")
        }
        if (role != ProjectRole.OWNER && role != ProjectRole.MAINTAINER && !actor.isSystemAdmin) {
            throw ForbiddenProjectActionException("Only owner or maintainer can manage access keys")
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

    fun validateAccessKeyName(name: String) {
        if (name.isBlank()) {
            throw InvalidProjectRequestException("Access key name must not be blank")
        }
    }

    fun validateAccessKeyScopes(
        scopes: Set<AccessKeyScope>,
        availableScopes: Set<AccessKeyScope>,
    ) {
        if (scopes.isEmpty()) {
            throw InvalidProjectRequestException("Access key must contain at least one scope")
        }
        if (!availableScopes.containsAll(scopes)) {
            throw InvalidProjectRequestException("Access key contains unsupported scopes")
        }
    }

    fun resolveExpiration(now: Instant, ttlSeconds: Long?, defaultTtlSeconds: Long): Instant? {
        val ttl = ttlSeconds ?: defaultTtlSeconds
        if (ttl <= 0) {
            throw InvalidProjectRequestException("TTL must be greater than zero")
        }
        return now.plusSeconds(ttl)
    }

    fun requireActiveAccessKey(key: ProjectAccessKey, now: Instant) {
        if (key.revokedAt != null) {
            throw ForbiddenProjectActionException("Access key has been revoked")
        }
        if (key.expiresAt != null && !key.expiresAt.isAfter(now)) {
            throw ForbiddenProjectActionException("Access key has expired")
        }
    }

    fun requireProjectKeyScope(
        actor: AuthenticatedActor,
        entity: ProjectEntity,
        action: AccessKeyAction,
    ) {
        if (actor.type == ActorType.PROJECT_KEY && !actor.hasScope(entity, action)) {
            throw ForbiddenProjectActionException(
                "Project key does not have ${entity.configValue}:${action.name.lowercase()} scope",
            )
        }
    }

    private fun AuthenticatedActor.hasScope(entity: ProjectEntity, action: AccessKeyAction): Boolean =
        scopes.contains(AccessKeyScope(entity, action))
}
