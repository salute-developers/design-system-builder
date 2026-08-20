package com.dsbuilder.projects.feature.projects.application.usecase

import com.dsbuilder.projects.feature.projects.application.AccessKeyNotFoundException
import com.dsbuilder.projects.feature.projects.application.ForbiddenProjectActionException
import com.dsbuilder.projects.feature.projects.application.ProjectNotFoundException
import com.dsbuilder.projects.feature.projects.application.port.AccessKeySecretManager
import com.dsbuilder.projects.feature.projects.application.port.ProjectRepository
import com.dsbuilder.projects.feature.projects.application.port.TransactionManager
import com.dsbuilder.projects.feature.projects.data.local.AccessKeyConfiguration
import com.dsbuilder.projects.feature.projects.domain.model.AccessKeyScope
import com.dsbuilder.projects.feature.projects.domain.model.AuthenticatedActor
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKey
import com.dsbuilder.projects.feature.projects.domain.model.ProjectAccessKeyStatus
import java.time.Clock
import java.time.Instant
import java.util.UUID

internal data class CreateProjectAccessKeyInput(
    val actor: AuthenticatedActor,
    val projectId: String,
    val name: String,
    val scopes: Set<AccessKeyScope>,
    val ttlSeconds: Long? = null,
)

internal data class CreatedProjectAccessKey(
    val accessKey: ProjectAccessKey,
    val rawSecret: String,
    val token: String,
)

internal data class VerifyProjectAccessKeyInput(
    val token: String,
)

internal data class VerifiedProjectAccessKey(
    val keyId: String,
    val projectId: String,
    val scopes: Set<AccessKeyScope>,
)

internal class CreateProjectAccessKeyUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
    private val accessKeyConfiguration: AccessKeyConfiguration,
    private val secretManager: AccessKeySecretManager,
    private val clock: Clock,
) {
    suspend fun execute(input: CreateProjectAccessKeyInput): CreatedProjectAccessKey =
        transactionManager.required {
            val project = repository.getProject(input.projectId) ?: throw ProjectNotFoundException(input.projectId)
            val member = repository.getMember(input.projectId, input.actor.userId)
            val role = policy.requireProjectAccess(input.actor, project, member)
            policy.requireAccessKeyManagement(input.actor, role)
            policy.validateAccessKeyName(input.name)
            policy.validateAccessKeyScopes(input.scopes, accessKeyConfiguration.availableScopes)

            val now = Instant.now(clock)
            val keyId = UUID.randomUUID().toString()
            val rawSecret = secretManager.generateSecret()
            val accessKey = ProjectAccessKey(
                id = keyId,
                projectId = input.projectId,
                name = input.name.trim(),
                scopes = input.scopes,
                secretHash = secretManager.hashSecret(rawSecret),
                createdByUserId = input.actor.userId,
                expiresAt = policy.resolveExpiration(
                    now = now,
                    ttlSeconds = input.ttlSeconds,
                    defaultTtlSeconds = accessKeyConfiguration.defaultTtl.inWholeSeconds,
                ),
                revokedAt = null,
                lastUsedAt = null,
                createdAt = now,
                updatedAt = now,
            )
            repository.createAccessKey(accessKey)
            CreatedProjectAccessKey(
                accessKey = accessKey,
                rawSecret = rawSecret,
                token = "${accessKeyConfiguration.keyPrefix}_${keyId}_$rawSecret",
            )
        }
}

internal class ListProjectAccessKeysUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
) {
    suspend fun execute(actor: AuthenticatedActor, projectId: String): List<ProjectAccessKey> =
        transactionManager.required {
            val project = repository.getProject(projectId) ?: throw ProjectNotFoundException(projectId)
            val member = repository.getMember(projectId, actor.userId)
            val role = policy.requireProjectAccess(actor, project, member)
            policy.requireAccessKeyManagement(actor, role)
            repository.listAccessKeys(projectId)
        }
}

internal class RevokeProjectAccessKeyUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
    private val clock: Clock,
) {
    suspend fun execute(actor: AuthenticatedActor, projectId: String, keyId: String): ProjectAccessKey =
        transactionManager.required {
            val project = repository.getProject(projectId) ?: throw ProjectNotFoundException(projectId)
            val member = repository.getMember(projectId, actor.userId)
            val role = policy.requireProjectAccess(actor, project, member)
            policy.requireAccessKeyManagement(actor, role)
            repository.updateAccessKeyStatus(
                projectId = projectId,
                keyId = keyId,
                status = ProjectAccessKeyStatus.REVOKED,
                revokedAt = Instant.now(clock),
                updatedAt = Instant.now(clock),
            ) ?: throw AccessKeyNotFoundException(projectId, keyId)
        }
}

internal class VerifyProjectAccessKeyUseCase(
    private val repository: ProjectRepository,
    private val transactionManager: TransactionManager,
    private val policy: ProjectAccessPolicy,
    private val accessKeyConfiguration: AccessKeyConfiguration,
    private val secretManager: AccessKeySecretManager,
    private val clock: Clock,
) {
    suspend fun execute(input: VerifyProjectAccessKeyInput): VerifiedProjectAccessKey =
        transactionManager.required {
            val (keyId, rawSecret) = parseToken(input.token)
            val accessKey = repository.getAccessKeyById(keyId)
                ?: throw ForbiddenProjectActionException("Project access key is invalid")
            val now = Instant.now(clock)
            policy.requireActiveAccessKey(accessKey, now)
            if (!secretManager.verifySecret(rawSecret, accessKey.secretHash)) {
                throw ForbiddenProjectActionException("Project access key is invalid")
            }
            repository.updateAccessKeyUsage(accessKey.id, now, now)
            VerifiedProjectAccessKey(
                keyId = accessKey.id,
                projectId = accessKey.projectId,
                scopes = accessKey.scopes,
            )
        }

    private fun parseToken(token: String): Pair<String, String> {
        val prefix = "${accessKeyConfiguration.keyPrefix}_"
        val parsedToken = token
            .takeIf { it.startsWith(prefix) }
            ?.removePrefix(prefix)
            ?.split('_', limit = 2)
            ?.takeIf { it.size == 2 && it[0].isNotBlank() && it[1].isNotBlank() }

        if (parsedToken == null) {
            throw ForbiddenProjectActionException("Project access key is invalid")
        }
        return parsedToken[0] to parsedToken[1]
    }
}
