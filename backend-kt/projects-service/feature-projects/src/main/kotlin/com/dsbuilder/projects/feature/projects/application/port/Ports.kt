package com.dsbuilder.projects.feature.projects.application.port

import com.dsbuilder.projects.feature.projects.application.IdentityProviderException
import com.dsbuilder.projects.feature.projects.domain.model.Project
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKey
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKeyStatus
import com.dsbuilder.projects.feature.projects.domain.model.ProjectMember
import com.dsbuilder.projects.feature.projects.domain.model.ProjectStatus
import java.time.Instant

internal data class IdentityUser(
    val userId: String,
    val email: String,
    val displayName: String?,
)

internal interface IdentityUserLookup {
    @Throws(IdentityProviderException::class)
    suspend fun findRegisteredUserByEmail(email: String): IdentityUser?
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

    suspend fun createAccessKey(accessKey: ProjectAccessKey)

    suspend fun listAccessKeys(projectId: String): List<ProjectAccessKey>

    suspend fun getAccessKey(projectId: String, keyId: String): ProjectAccessKey?

    suspend fun getAccessKeyById(keyId: String): ProjectAccessKey?

    suspend fun updateAccessKeyUsage(keyId: String, lastUsedAt: Instant, updatedAt: Instant)

    suspend fun updateAccessKeyStatus(
        projectId: String,
        keyId: String,
        status: ProjectAccessKeyStatus,
        revokedAt: Instant?,
        updatedAt: Instant,
    ): ProjectAccessKey?
}

internal interface TransactionManager {
    suspend fun <T> required(block: suspend () -> T): T
}

internal interface AccessKeySecretManager {
    fun generateSecret(): String

    fun hashSecret(rawSecret: String): String

    fun verifySecret(rawSecret: String, secretHash: String): Boolean
}
