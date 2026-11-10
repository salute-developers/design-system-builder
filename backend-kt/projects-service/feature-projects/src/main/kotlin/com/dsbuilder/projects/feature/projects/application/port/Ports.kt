package com.dsbuilder.projects.feature.projects.application.port

import com.dsbuilder.projects.feature.projects.application.IdentityProviderException
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectMember
import com.dsbuilder.projects.feature.projects.domain.model.ProjectStatus
import java.time.Instant

internal data class IdentityUser(
    val userId: String,
    val email: String,
    val displayName: String?,
    val username: String? = null,
)

internal interface IdentityUserLookup {
    @Throws(IdentityProviderException::class)
    suspend fun findRegisteredUserByEmail(email: String): IdentityUser?

    suspend fun findRegisteredUserByIdentifier(identifier: String): IdentityUser? =
        findRegisteredUserByEmail(identifier)

    suspend fun findRegisteredUserById(userId: String): IdentityUser? =
        findRegisteredUserByIdentifier(userId)

    suspend fun searchRegisteredUsers(query: String, limit: Int): List<IdentityUser> =
        listOfNotNull(findRegisteredUserByEmail(query)).take(limit)
}

internal interface ProjectRepository {
    suspend fun createProject(project: Project)

    suspend fun listProjectsForUser(userId: String): List<Project>

    suspend fun listAllProjects(): List<Project>

    suspend fun getProject(projectId: String): Project?

    suspend fun updateProjectMetadata(
        projectId: String,
        name: String,
        description: String?,
        updatedAt: Instant,
    ): Project?

    suspend fun updateProjectStatus(
        projectId: String,
        status: ProjectStatus,
        updatedAt: Instant,
    ): Project?

    suspend fun listMembers(projectId: String): List<ProjectMember>

    suspend fun getMember(projectId: String, userId: String): ProjectMember?

    suspend fun upsertMember(member: ProjectMember)

    suspend fun removeMember(projectId: String, userId: String): Boolean
}

internal interface TransactionManager {
    suspend fun <T> required(block: suspend () -> T): T
}
