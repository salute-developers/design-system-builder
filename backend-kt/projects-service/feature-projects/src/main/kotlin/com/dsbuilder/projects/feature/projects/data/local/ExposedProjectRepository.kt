package com.dsbuilder.projects.feature.projects.data.local

import com.dsbuilder.projects.feature.projects.application.port.ProjectRepository
import com.dsbuilder.projects.feature.projects.data.local.db.ProjectAccessKeysTable
import com.dsbuilder.projects.feature.projects.data.local.db.ProjectMembersTable
import com.dsbuilder.projects.feature.projects.data.local.db.ProjectsTable
import com.dsbuilder.projects.feature.projects.domain.model.AccessKeyScope
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKey
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKeyStatus
import com.dsbuilder.projects.feature.projects.domain.model.ProjectMember
import com.dsbuilder.projects.feature.projects.domain.model.ProjectRole
import com.dsbuilder.projects.feature.projects.domain.model.ProjectStatus
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.update
import org.jetbrains.exposed.v1.jdbc.upsert
import java.time.Instant

internal class ExposedProjectRepository : ProjectRepository {
    override suspend fun createProject(project: Project) {
        ProjectsTable.insert {
            it[id] = project.id
            it[name] = project.name
            it[description] = project.description
            it[status] = project.status.name.lowercase()
            it[ownerUserId] = project.ownerUserId
            it[createdAt] = project.createdAt
            it[updatedAt] = project.updatedAt
        }
    }

    override suspend fun listProjectsForUser(userId: String): List<Project> {
        val ownedProjects = ProjectsTable
            .select(ProjectsTable.columns)
            .where { ProjectsTable.ownerUserId eq userId }
            .map { it.toProject() }

        val memberProjectIds = ProjectMembersTable
            .select(ProjectMembersTable.projectId)
            .where { ProjectMembersTable.userId eq userId }
            .map { it[ProjectMembersTable.projectId] }

        val memberProjects = if (memberProjectIds.isEmpty()) {
            emptyList()
        } else {
            ProjectsTable
                .select(ProjectsTable.columns)
                .where { ProjectsTable.id inList memberProjectIds }
                .map { it.toProject() }
        }

        return (ownedProjects + memberProjects)
            .associateBy { it.id }
            .values
            .sortedBy { it.createdAt }
    }

    override suspend fun listAllProjects(): List<Project> =
        ProjectsTable
            .select(ProjectsTable.columns)
            .map { it.toProject() }
            .sortedBy { it.createdAt }

    override suspend fun getProject(projectId: String): Project? =
        ProjectsTable
            .select(ProjectsTable.columns)
            .where { ProjectsTable.id eq projectId }
            .singleOrNull()
            ?.toProject()

    override suspend fun updateProjectMetadata(
        projectId: String,
        name: String,
        description: String?,
        updatedAt: Instant,
    ): Project? {
        ProjectsTable.update({ ProjectsTable.id eq projectId }) {
            it[ProjectsTable.name] = name
            it[ProjectsTable.description] = description
            it[ProjectsTable.updatedAt] = updatedAt
        }
        return getProject(projectId)
    }

    override suspend fun updateProjectStatus(
        projectId: String,
        status: ProjectStatus,
        updatedAt: Instant,
    ): Project? {
        ProjectsTable.update({ ProjectsTable.id eq projectId }) {
            it[ProjectsTable.status] = status.name.lowercase()
            it[ProjectsTable.updatedAt] = updatedAt
        }
        return getProject(projectId)
    }

    override suspend fun listMembers(projectId: String): List<ProjectMember> =
        ProjectMembersTable
            .select(ProjectMembersTable.columns)
            .where { ProjectMembersTable.projectId eq projectId }
            .map { it.toMember() }

    override suspend fun getMember(projectId: String, userId: String): ProjectMember? =
        ProjectMembersTable
            .select(ProjectMembersTable.columns)
            .where {
                (ProjectMembersTable.projectId eq projectId) and
                    (ProjectMembersTable.userId eq userId)
            }
            .singleOrNull()
            ?.toMember()

    override suspend fun upsertMember(member: ProjectMember) {
        ProjectMembersTable.upsert(
            keys = arrayOf(ProjectMembersTable.projectId, ProjectMembersTable.userId),
        ) {
            it[projectId] = member.projectId
            it[userId] = member.userId
            it[role] = member.role.name.lowercase()
            it[createdAt] = member.createdAt
            it[updatedAt] = member.updatedAt
        }
    }

    override suspend fun removeMember(projectId: String, userId: String): Boolean =
        ProjectMembersTable.deleteWhere {
            (ProjectMembersTable.projectId eq projectId) and
                (ProjectMembersTable.userId eq userId)
        } > 0

    override suspend fun createAccessKey(accessKey: ProjectAccessKey) {
        ProjectAccessKeysTable.insert {
            it[id] = accessKey.id
            it[projectId] = accessKey.projectId
            it[name] = accessKey.name
            it[scopes] = accessKey.scopes.joinToString(",") { scope -> scope.value }
            it[secretHash] = accessKey.secretHash
            it[status] = accessKey.status().name.lowercase()
            it[createdByUserId] = accessKey.createdByUserId
            it[expiresAt] = accessKey.expiresAt
            it[revokedAt] = accessKey.revokedAt
            it[lastUsedAt] = accessKey.lastUsedAt
            it[createdAt] = accessKey.createdAt
            it[updatedAt] = accessKey.updatedAt
        }
    }

    override suspend fun listAccessKeys(projectId: String): List<ProjectAccessKey> =
        ProjectAccessKeysTable
            .select(ProjectAccessKeysTable.columns)
            .where { ProjectAccessKeysTable.projectId eq projectId }
            .map { it.toAccessKey() }
            .sortedBy { it.createdAt }

    override suspend fun getAccessKey(projectId: String, keyId: String): ProjectAccessKey? =
        ProjectAccessKeysTable
            .select(ProjectAccessKeysTable.columns)
            .where {
                (ProjectAccessKeysTable.projectId eq projectId) and
                    (ProjectAccessKeysTable.id eq keyId)
            }
            .singleOrNull()
            ?.toAccessKey()

    override suspend fun getAccessKeyById(keyId: String): ProjectAccessKey? =
        ProjectAccessKeysTable
            .select(ProjectAccessKeysTable.columns)
            .where { ProjectAccessKeysTable.id eq keyId }
            .singleOrNull()
            ?.toAccessKey()

    override suspend fun updateAccessKeyUsage(keyId: String, lastUsedAt: Instant, updatedAt: Instant) {
        ProjectAccessKeysTable.update({ ProjectAccessKeysTable.id eq keyId }) {
            it[ProjectAccessKeysTable.lastUsedAt] = lastUsedAt
            it[ProjectAccessKeysTable.updatedAt] = updatedAt
        }
    }

    override suspend fun updateAccessKeyStatus(
        projectId: String,
        keyId: String,
        status: ProjectAccessKeyStatus,
        revokedAt: Instant?,
        updatedAt: Instant,
    ): ProjectAccessKey? {
        ProjectAccessKeysTable.update(
            where = {
                (ProjectAccessKeysTable.projectId eq projectId) and
                    (ProjectAccessKeysTable.id eq keyId)
            },
        ) {
            it[ProjectAccessKeysTable.status] = status.name.lowercase()
            it[ProjectAccessKeysTable.revokedAt] = revokedAt
            it[ProjectAccessKeysTable.updatedAt] = updatedAt
        }
        return getAccessKey(projectId, keyId)
    }

    private fun ResultRow.toProject(): Project =
        Project(
            id = this[ProjectsTable.id],
            name = this[ProjectsTable.name],
            description = this[ProjectsTable.description],
            status = ProjectStatus.valueOf(this[ProjectsTable.status].uppercase()),
            ownerUserId = this[ProjectsTable.ownerUserId],
            createdAt = this[ProjectsTable.createdAt],
            updatedAt = this[ProjectsTable.updatedAt],
        )

    private fun ResultRow.toMember(): ProjectMember =
        ProjectMember(
            projectId = this[ProjectMembersTable.projectId],
            userId = this[ProjectMembersTable.userId],
            role = ProjectRole.valueOf(this[ProjectMembersTable.role].uppercase()),
            createdAt = this[ProjectMembersTable.createdAt],
            updatedAt = this[ProjectMembersTable.updatedAt],
        )

    private fun ResultRow.toAccessKey(): ProjectAccessKey =
        ProjectAccessKey(
            id = this[ProjectAccessKeysTable.id],
            projectId = this[ProjectAccessKeysTable.projectId],
            name = this[ProjectAccessKeysTable.name],
            scopes = this[ProjectAccessKeysTable.scopes]
                .split(',')
                .mapNotNull { AccessKeyScope.parse(it) }
                .toSet(),
            secretHash = this[ProjectAccessKeysTable.secretHash],
            createdByUserId = this[ProjectAccessKeysTable.createdByUserId],
            expiresAt = this[ProjectAccessKeysTable.expiresAt],
            revokedAt = this[ProjectAccessKeysTable.revokedAt],
            lastUsedAt = this[ProjectAccessKeysTable.lastUsedAt],
            createdAt = this[ProjectAccessKeysTable.createdAt],
            updatedAt = this[ProjectAccessKeysTable.updatedAt],
        )

    private fun ProjectAccessKey.status(): ProjectAccessKeyStatus =
        if (revokedAt != null) {
            ProjectAccessKeyStatus.REVOKED
        } else {
            ProjectAccessKeyStatus.ACTIVE
        }
}
