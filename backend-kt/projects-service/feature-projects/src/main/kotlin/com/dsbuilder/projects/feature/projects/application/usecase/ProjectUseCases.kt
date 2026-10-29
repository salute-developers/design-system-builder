package com.dsbuilder.projects.feature.projects.application.usecase

import com.dsbuilder.projects.feature.projects.application.IdentityProviderException
import com.dsbuilder.projects.feature.projects.application.InvalidProjectRequestException
import com.dsbuilder.projects.feature.projects.application.ProjectNotFoundException
import com.dsbuilder.projects.feature.projects.application.RegisteredIdentityUserNotFoundException
import com.dsbuilder.projects.feature.projects.application.port.IdentityUser
import com.dsbuilder.projects.feature.projects.application.port.IdentityUserLookup
import com.dsbuilder.projects.feature.projects.application.port.ProjectRepository
import com.dsbuilder.projects.feature.projects.application.port.TransactionManager
import com.dsbuilder.projects.feature.projects.domain.model.AccessKeyAction
import com.dsbuilder.projects.feature.projects.domain.model.ActorType
import com.dsbuilder.projects.feature.projects.domain.model.AuthenticatedActor
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectEntity
import com.dsbuilder.projects.feature.projects.domain.model.ProjectMember
import com.dsbuilder.projects.feature.projects.domain.model.ProjectRole
import com.dsbuilder.projects.feature.projects.domain.model.ProjectStatus
import java.time.Clock
import java.time.Instant
import java.util.UUID

internal data class CreateProjectInput(
    val actor: AuthenticatedActor,
    val name: String,
    val description: String?,
)

internal data class UpdateProjectInput(
    val actor: AuthenticatedActor,
    val projectId: String,
    val name: String?,
    val description: String?,
)

internal data class ManageMemberInput(
    val actor: AuthenticatedActor,
    val projectId: String,
    val userId: String,
    val role: ProjectRole? = null,
)

internal data class AddProjectMemberInput(
    val actor: AuthenticatedActor,
    val projectId: String,
    val email: String,
    val role: ProjectRole,
)

internal data class GetEffectiveRoleInput(
    val userId: String,
    val projectId: String,
    val isSystemAdmin: Boolean,
)

internal data class ListProjectsInput(
    val actor: AuthenticatedActor,
)

internal data class ProjectWithEffectiveRole(
    val project: Project,
    val effectiveRole: ProjectRole,
    val ownerIdentity: IdentityUser? = null,
)

internal data class ProjectMemberWithIdentity(
    val member: ProjectMember,
    val identity: IdentityUser?,
)

internal class CreateProjectUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
    private val clock: Clock,
) {
    suspend fun execute(input: CreateProjectInput): Project =
        transactionManager.required {
            policy.validateProjectName(input.name)
            val now = Instant.now(clock)
            val project = Project(
                id = UUID.randomUUID().toString(),
                name = input.name.trim(),
                description = input.description?.trim()?.ifBlank { null },
                status = ProjectStatus.ACTIVE,
                ownerUserId = input.actor.userId,
                createdAt = now,
                updatedAt = now,
            )
            repository.createProject(project)
            project
        }
}

internal class GetProjectUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
    private val identityUserLookup: IdentityUserLookup,
) {
    suspend fun execute(actor: AuthenticatedActor, projectId: String): ProjectWithEffectiveRole {
        val result = transactionManager.required {
            val project = repository.getProject(projectId) ?: throw ProjectNotFoundException(projectId)
            val member = repository.getMember(projectId, actor.userId)
            val effectiveRole = policy.requireProjectAccess(actor, project, member)
            policy.requireProjectKeyScope(actor, ProjectEntity.PROJECTS, AccessKeyAction.READ)
            ProjectWithEffectiveRole(project, effectiveRole)
        }
        return result.copy(
            ownerIdentity = if (actor.type == ActorType.USER) {
                identityUserLookup.findRegisteredUserByIdBestEffort(result.project.ownerUserId)
            } else {
                null
            },
        )
    }
}

internal class ListProjectsUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
) {
    suspend fun execute(input: ListProjectsInput): List<ProjectWithEffectiveRole> =
        transactionManager.required {
            val projects = if (input.actor.isSystemAdmin) {
                repository.listAllProjects()
            } else {
                repository.listProjectsForUser(input.actor.userId)
            }
            projects.map { project ->
                val member = if (input.actor.isSystemAdmin || project.ownerUserId == input.actor.userId) {
                    null
                } else {
                    repository.getMember(project.id, input.actor.userId)
                }
                ProjectWithEffectiveRole(
                    project = project,
                    effectiveRole = policy.requireProjectAccess(input.actor, project, member),
                )
            }
        }
}

internal class UpdateProjectUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
    private val clock: Clock,
) {
    suspend fun execute(input: UpdateProjectInput): Project =
        transactionManager.required {
            val project = repository.getProject(input.projectId) ?: throw ProjectNotFoundException(input.projectId)
            val member = repository.getMember(input.projectId, input.actor.userId)
            val role = policy.requireProjectAccess(input.actor, project, member)
            policy.requireProjectMutationAccess(input.actor)
            policy.requireMetadataUpdate(role)
            policy.requireMutableProject(project)

            val newName = (input.name ?: project.name).trim()
            val newDescription = input.description?.trim()?.ifBlank { null } ?: project.description
            policy.validateProjectName(newName)

            repository.updateProjectMetadata(
                projectId = input.projectId,
                name = newName,
                description = newDescription,
                updatedAt = Instant.now(clock),
            ) ?: throw ProjectNotFoundException(input.projectId)
        }
}

internal class ArchiveProjectUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
    private val clock: Clock,
) {
    suspend fun execute(actor: AuthenticatedActor, projectId: String): Project =
        updateStatus(actor, projectId, ProjectStatus.ARCHIVED)

    private suspend fun updateStatus(
        actor: AuthenticatedActor,
        projectId: String,
        status: ProjectStatus,
    ): Project =
        transactionManager.required {
            val project = repository.getProject(projectId) ?: throw ProjectNotFoundException(projectId)
            val member = repository.getMember(projectId, actor.userId)
            val role = policy.requireProjectAccess(actor, project, member)
            policy.requireProjectMutationAccess(actor)
            policy.requireArchive(role)
            repository.updateProjectStatus(projectId, status, Instant.now(clock))
                ?: throw ProjectNotFoundException(projectId)
        }
}

internal class RestoreProjectUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
    private val clock: Clock,
) {
    suspend fun execute(actor: AuthenticatedActor, projectId: String): Project =
        transactionManager.required {
            val project = repository.getProject(projectId) ?: throw ProjectNotFoundException(projectId)
            val member = repository.getMember(projectId, actor.userId)
            val role = policy.requireProjectAccess(actor, project, member)
            policy.requireProjectMutationAccess(actor)
            policy.requireArchive(role)
            repository.updateProjectStatus(projectId, ProjectStatus.ACTIVE, Instant.now(clock))
                ?: throw ProjectNotFoundException(projectId)
        }
}

internal class ListProjectMembersUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
    private val identityUserLookup: IdentityUserLookup,
) {
    suspend fun execute(actor: AuthenticatedActor, projectId: String): List<ProjectMemberWithIdentity> {
        val members = transactionManager.required {
            val project = repository.getProject(projectId) ?: throw ProjectNotFoundException(projectId)
            val member = repository.getMember(projectId, actor.userId)
            policy.requireProjectAccess(actor, project, member)
            policy.requireProjectKeyScope(actor, ProjectEntity.MEMBERS, AccessKeyAction.READ)
            repository.listMembers(projectId)
        }
        return members.map { member ->
            ProjectMemberWithIdentity(member, identityUserLookup.findRegisteredUserByIdBestEffort(member.userId))
        }
    }
}

private suspend fun IdentityUserLookup.findRegisteredUserByIdBestEffort(userId: String): IdentityUser? =
    try {
        findRegisteredUserById(userId)
    } catch (_: IdentityProviderException) {
        null
    }

internal class AddProjectMemberUseCase(
    private val identityUserLookup: IdentityUserLookup,
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
    private val clock: Clock,
) {
    suspend fun execute(input: AddProjectMemberInput): ProjectMember =
        transactionManager.required {
            val normalizedEmail = input.email.trim().lowercase()
            if (normalizedEmail.isBlank()) {
                throw InvalidProjectRequestException("Member email must not be blank")
            }
            policy.validateManageableRole(input.role)
            val project = repository.getProject(input.projectId) ?: throw ProjectNotFoundException(input.projectId)
            val actorMembership = repository.getMember(input.projectId, input.actor.userId)
            val actorRole = policy.requireProjectAccess(input.actor, project, actorMembership)
            policy.requireMutableProject(project)
            policy.requireProjectKeyScope(input.actor, ProjectEntity.MEMBERS, AccessKeyAction.WRITE)
            val identityUser = identityUserLookup.findRegisteredUserByIdentifier(normalizedEmail)
                ?: throw RegisteredIdentityUserNotFoundException(normalizedEmail)
            policy.requireMemberManagement(
                actorRole,
                identityUser.userId,
                project,
                MemberManagementPermission.ADD,
                input.actor,
            )

            val existing = repository.getMember(input.projectId, identityUser.userId)
            val now = Instant.now(clock)
            val member = ProjectMember(
                projectId = input.projectId,
                userId = identityUser.userId,
                role = input.role,
                createdAt = existing?.createdAt ?: now,
                updatedAt = now,
            )
            repository.upsertMember(member)
            member
        }
}

internal class SearchProjectMemberCandidatesUseCase(
    private val identityUserLookup: IdentityUserLookup,
) {
    suspend fun execute(actor: AuthenticatedActor, query: String): List<IdentityUser> {
        if (actor.type != ActorType.USER) {
            throw InvalidProjectRequestException("Only authenticated users can search member candidates")
        }
        val normalizedQuery = query.trim()
        if (normalizedQuery.length < 2) return emptyList()
        return identityUserLookup.searchRegisteredUsers(normalizedQuery, 10)
    }
}

internal class UpdateProjectMemberRoleUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
    private val clock: Clock,
) {
    suspend fun execute(input: ManageMemberInput): ProjectMember =
        transactionManager.required {
            val roleToAssign = input.role ?: throw InvalidProjectRequestException("Role is required")
            policy.validateManageableRole(roleToAssign)
            val project = repository.getProject(input.projectId) ?: throw ProjectNotFoundException(input.projectId)
            val actorMembership = repository.getMember(input.projectId, input.actor.userId)
            val actorRole = policy.requireProjectAccess(input.actor, project, actorMembership)
            policy.requireMutableProject(project)
            policy.requireProjectKeyScope(input.actor, ProjectEntity.MEMBERS, AccessKeyAction.WRITE)
            policy.requireMemberManagement(
                actorRole,
                input.userId,
                project,
                MemberManagementPermission.CHANGE_ROLE,
                input.actor,
            )

            val existing = repository.getMember(input.projectId, input.userId)
                ?: throw ProjectNotFoundException("member:${input.userId}")
            val updatedMember = existing.copy(role = roleToAssign, updatedAt = Instant.now(clock))
            repository.upsertMember(updatedMember)
            updatedMember
        }
}

internal class RemoveProjectMemberUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
) {
    suspend fun execute(actor: AuthenticatedActor, projectId: String, userId: String) {
        transactionManager.required {
            val project = repository.getProject(projectId) ?: throw ProjectNotFoundException(projectId)
            val actorMembership = repository.getMember(projectId, actor.userId)
            val actorRole = policy.requireProjectAccess(actor, project, actorMembership)
            policy.requireMutableProject(project)
            policy.requireProjectKeyScope(actor, ProjectEntity.MEMBERS, AccessKeyAction.DELETE)
            policy.requireMemberManagement(
                actorRole,
                userId,
                project,
                MemberManagementPermission.REMOVE,
                actor,
            )

            if (!repository.removeMember(projectId, userId)) {
                throw ProjectNotFoundException("member:$userId")
            }
        }
    }
}

internal class GetEffectiveProjectRoleUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
) {
    suspend fun execute(input: GetEffectiveRoleInput): ProjectRole? =
        transactionManager.required {
            val project = repository.getProject(input.projectId) ?: return@required null
            val actor = AuthenticatedActor(
                type = ActorType.USER,
                userId = input.userId,
                isSystemAdmin = input.isSystemAdmin,
            )
            val member = repository.getMember(input.projectId, input.userId)
            policy.resolveRole(actor, project, member)
        }
}
