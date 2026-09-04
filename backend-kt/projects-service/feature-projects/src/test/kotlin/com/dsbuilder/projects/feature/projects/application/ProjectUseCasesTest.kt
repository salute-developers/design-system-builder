package com.dsbuilder.projects.feature.projects.application

import com.dsbuilder.projects.feature.projects.application.port.IdentityUser
import com.dsbuilder.projects.feature.projects.application.port.IdentityUserLookup
import com.dsbuilder.projects.feature.projects.application.port.ProjectRepository
import com.dsbuilder.projects.feature.projects.application.port.TransactionManager
import com.dsbuilder.projects.feature.projects.application.usecase.AddProjectMemberInput
import com.dsbuilder.projects.feature.projects.application.usecase.AddProjectMemberUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ArchiveProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.CreateProjectInput
import com.dsbuilder.projects.feature.projects.application.usecase.CreateProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectsInput
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectsUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ManageMemberInput
import com.dsbuilder.projects.feature.projects.application.usecase.ProjectAccessPolicy
import com.dsbuilder.projects.feature.projects.application.usecase.RestoreProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.UpdateProjectMemberRoleUseCase
import com.dsbuilder.projects.feature.projects.domain.model.ActorType
import com.dsbuilder.projects.feature.projects.domain.model.AuthenticatedActor
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKey
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKeyStatus
import com.dsbuilder.projects.feature.projects.domain.model.ProjectMember
import com.dsbuilder.projects.feature.projects.domain.model.ProjectRole
import com.dsbuilder.projects.feature.projects.domain.model.ProjectStatus
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ProjectUseCasesTest {
    private val clock = Clock.fixed(Instant.parse("2024-01-01T00:00:00Z"), ZoneOffset.UTC)
    private val repository = InMemoryProjectRepository()
    private val tx = ImmediateTransactionManager()
    private val policy = ProjectAccessPolicy()
    private val identityUserLookup = InMemoryIdentityUserLookup()

    @Test
    fun `create project keeps owner outside members table`() {
        kotlinx.coroutines.runBlocking {
            val created = CreateProjectUseCase(repository, tx, policy, clock).execute(
                CreateProjectInput(
                    actor = AuthenticatedActor(ActorType.USER, "owner-1", isSystemAdmin = false),
                    name = "Workspace",
                    description = "Main workspace",
                ),
            )

            assertEquals("owner-1", created.ownerUserId)
            assertFalse(repository.members.containsKey(created.id to "owner-1"))
        }
    }

    @Test
    fun `owner can archive and restore project`() {
        kotlinx.coroutines.runBlocking {
            repository.seedProject(
                Project(
                    id = "project-1",
                    name = "Workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-1",
                    createdAt = Instant.now(clock),
                    updatedAt = Instant.now(clock),
                ),
            )

            val archived = ArchiveProjectUseCase(repository, tx, policy, clock)
                .execute(AuthenticatedActor(ActorType.USER, "owner-1", false), "project-1")
            val restored = RestoreProjectUseCase(repository, tx, policy, clock)
                .execute(AuthenticatedActor(ActorType.USER, "owner-1", false), "project-1")

            assertEquals(ProjectStatus.ARCHIVED, archived.status)
            assertEquals(ProjectStatus.ACTIVE, restored.status)
        }
    }

    @Test
    fun `maintainer can change editor role to viewer`() {
        kotlinx.coroutines.runBlocking {
            repository.seedProject(
                Project(
                    id = "project-1",
                    name = "Workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-1",
                    createdAt = Instant.now(clock),
                    updatedAt = Instant.now(clock),
                ),
            )
            repository.seedMember(
                ProjectMember(
                    "project-1",
                    "maintainer-1",
                    ProjectRole.MAINTAINER,
                    Instant.now(clock),
                    Instant.now(clock),
                ),
            )
            repository.seedMember(
                ProjectMember("project-1", "editor-1", ProjectRole.EDITOR, Instant.now(clock), Instant.now(clock)),
            )

            val updated = UpdateProjectMemberRoleUseCase(repository, tx, policy, clock).execute(
                ManageMemberInput(
                    actor = AuthenticatedActor(ActorType.USER, "maintainer-1", false),
                    projectId = "project-1",
                    userId = "editor-1",
                    role = ProjectRole.VIEWER,
                ),
            )

            assertEquals(ProjectRole.VIEWER, updated.role)
        }
    }

    @Test
    fun `list projects returns owned and member projects for user`() {
        kotlinx.coroutines.runBlocking {
            repository.seedProject(
                Project(
                    id = "project-1",
                    name = "Owned workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-1",
                    createdAt = Instant.parse("2024-01-01T00:00:00Z"),
                    updatedAt = Instant.parse("2024-01-01T00:00:00Z"),
                ),
            )
            repository.seedProject(
                Project(
                    id = "project-2",
                    name = "Member workspace",
                    description = null,
                    status = ProjectStatus.ARCHIVED,
                    ownerUserId = "owner-2",
                    createdAt = Instant.parse("2024-01-02T00:00:00Z"),
                    updatedAt = Instant.parse("2024-01-02T00:00:00Z"),
                ),
            )
            repository.seedProject(
                Project(
                    id = "project-3",
                    name = "Foreign workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-3",
                    createdAt = Instant.parse("2024-01-03T00:00:00Z"),
                    updatedAt = Instant.parse("2024-01-03T00:00:00Z"),
                ),
            )
            repository.seedMember(
                ProjectMember(
                    "project-2",
                    "owner-1",
                    ProjectRole.VIEWER,
                    Instant.parse("2024-01-02T00:00:00Z"),
                    Instant.parse("2024-01-02T00:00:00Z"),
                ),
            )

            val projects = ListProjectsUseCase(repository, tx).execute(
                ListProjectsInput(actor = AuthenticatedActor(ActorType.USER, "owner-1", false)),
            )

            assertEquals(listOf("project-1", "project-2"), projects.map { it.id })
            assertTrue(projects.any { it.status == ProjectStatus.ARCHIVED })
        }
    }

    @Test
    fun `archived project blocks member changes`() {
        kotlinx.coroutines.runBlocking {
            repository.seedProject(
                Project(
                    id = "project-1",
                    name = "Workspace",
                    description = null,
                    status = ProjectStatus.ARCHIVED,
                    ownerUserId = "owner-1",
                    createdAt = Instant.now(clock),
                    updatedAt = Instant.now(clock),
                ),
            )
            identityUserLookup.usersByEmail["viewer@example.com"] = IdentityUser(
                userId = "viewer-1",
                email = "viewer@example.com",
                displayName = "Viewer One",
            )

            kotlin.test.assertFailsWith<ForbiddenProjectActionException> {
                AddProjectMemberUseCase(identityUserLookup, repository, tx, policy, clock).execute(
                    AddProjectMemberInput(
                        actor = AuthenticatedActor(ActorType.USER, "owner-1", false),
                        projectId = "project-1",
                        email = "viewer@example.com",
                        role = ProjectRole.VIEWER,
                    ),
                )
            }
        }
    }

    @Test
    fun `add member resolves registered user by email`() {
        kotlinx.coroutines.runBlocking {
            repository.seedProject(
                Project(
                    id = "project-1",
                    name = "Workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-1",
                    createdAt = Instant.now(clock),
                    updatedAt = Instant.now(clock),
                ),
            )
            identityUserLookup.usersByEmail["editor@example.com"] = IdentityUser(
                userId = "editor-1",
                email = "editor@example.com",
                displayName = "Editor One",
            )

            val created = AddProjectMemberUseCase(identityUserLookup, repository, tx, policy, clock).execute(
                AddProjectMemberInput(
                    actor = AuthenticatedActor(ActorType.USER, "owner-1", false),
                    projectId = "project-1",
                    email = "editor@example.com",
                    role = ProjectRole.EDITOR,
                ),
            )

            assertEquals("editor-1", created.userId)
            assertEquals(ProjectRole.EDITOR, created.role)
        }
    }

    @Test
    fun `add member fails when registered user is missing`() {
        kotlinx.coroutines.runBlocking {
            repository.seedProject(
                Project(
                    id = "project-1",
                    name = "Workspace",
                    description = null,
                    status = ProjectStatus.ACTIVE,
                    ownerUserId = "owner-1",
                    createdAt = Instant.now(clock),
                    updatedAt = Instant.now(clock),
                ),
            )

            kotlin.test.assertFailsWith<RegisteredIdentityUserNotFoundException> {
                AddProjectMemberUseCase(identityUserLookup, repository, tx, policy, clock).execute(
                    AddProjectMemberInput(
                        actor = AuthenticatedActor(ActorType.USER, "owner-1", false),
                        projectId = "project-1",
                        email = "missing@example.com",
                        role = ProjectRole.VIEWER,
                    ),
                )
            }
        }
    }
}

private class ImmediateTransactionManager : TransactionManager {
    override suspend fun <T> required(block: suspend () -> T): T = block()
}

private class InMemoryProjectRepository : ProjectRepository {
    val projects = linkedMapOf<String, Project>()
    val members = linkedMapOf<Pair<String, String>, ProjectMember>()
    val accessKeys = linkedMapOf<String, ProjectAccessKey>()

    override suspend fun createProject(project: Project) {
        projects[project.id] = project
    }

    override suspend fun listProjectsForUser(userId: String): List<Project> =
        projects.values.filter { project ->
            project.ownerUserId == userId || members.containsKey(project.id to userId)
        }

    override suspend fun listAllProjects(): List<Project> = projects.values.toList()

    override suspend fun getProject(projectId: String): Project? = projects[projectId]

    override suspend fun updateProjectMetadata(
        projectId: String,
        name: String,
        description: String?,
        updatedAt: Instant,
    ): Project? {
        val project = projects[projectId] ?: return null
        return project.copy(name = name, description = description, updatedAt = updatedAt).also {
            projects[projectId] = it
        }
    }

    override suspend fun updateProjectStatus(
        projectId: String,
        status: ProjectStatus,
        updatedAt: Instant,
    ): Project? {
        val project = projects[projectId] ?: return null
        return project.copy(status = status, updatedAt = updatedAt).also {
            projects[projectId] = it
        }
    }

    override suspend fun listMembers(projectId: String): List<ProjectMember> =
        members.values.filter { it.projectId == projectId }

    override suspend fun getMember(projectId: String, userId: String): ProjectMember? =
        members[projectId to userId]

    override suspend fun upsertMember(member: ProjectMember) {
        members[member.projectId to member.userId] = member
    }

    override suspend fun removeMember(projectId: String, userId: String): Boolean =
        members.remove(projectId to userId) != null

    override suspend fun createAccessKey(accessKey: ProjectAccessKey) {
        accessKeys[accessKey.id] = accessKey
    }

    override suspend fun listAccessKeys(projectId: String): List<ProjectAccessKey> =
        accessKeys.values.filter { it.projectId == projectId }

    override suspend fun getAccessKey(projectId: String, keyId: String): ProjectAccessKey? =
        accessKeys[keyId]?.takeIf { it.projectId == projectId }

    override suspend fun getAccessKeyById(keyId: String): ProjectAccessKey? = accessKeys[keyId]

    override suspend fun updateAccessKeyUsage(keyId: String, lastUsedAt: Instant, updatedAt: Instant) {
        val current = accessKeys[keyId] ?: return
        accessKeys[keyId] = current.copy(lastUsedAt = lastUsedAt, updatedAt = updatedAt)
    }

    override suspend fun updateAccessKeyStatus(
        projectId: String,
        keyId: String,
        status: ProjectAccessKeyStatus,
        revokedAt: Instant?,
        updatedAt: Instant,
    ): ProjectAccessKey? {
        val current = accessKeys[keyId]?.takeIf { it.projectId == projectId } ?: return null
        return current.copy(
            revokedAt = revokedAt,
            updatedAt = updatedAt,
        ).also { accessKeys[keyId] = it }
    }

    fun seedProject(project: Project) {
        projects[project.id] = project
    }

    fun seedMember(member: ProjectMember) {
        members[member.projectId to member.userId] = member
    }
}

private class InMemoryIdentityUserLookup : IdentityUserLookup {
    val usersByEmail = linkedMapOf<String, IdentityUser>()

    override suspend fun findRegisteredUserByEmail(email: String): IdentityUser? = usersByEmail[email]
}
