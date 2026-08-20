package com.dsbuilder.projects.feature.projects.domain.model

import java.time.Instant

internal data class Project(
    val id: String,
    val name: String,
    val description: String?,
    val status: ProjectStatus,
    val ownerUserId: String,
    val createdAt: Instant,
    val updatedAt: Instant,
)

internal enum class ProjectStatus {
    ACTIVE,
    ARCHIVED,
}

internal data class ProjectMember(
    val projectId: String,
    val userId: String,
    val role: ProjectRole,
    val createdAt: Instant,
    val updatedAt: Instant,
)

internal enum class ProjectRole {
    VIEWER,
    EDITOR,
    MAINTAINER,
    OWNER,
}

internal data class AuthenticatedActor(
    val type: ActorType,
    val userId: String,
    val isSystemAdmin: Boolean,
    val projectId: String? = null,
    val projectKeyId: String? = null,
    val scopes: Set<AccessKeyScope> = emptySet(),
)

internal enum class ActorType {
    USER,
    PROJECT_KEY,
}

internal enum class AccessKeyAction {
    READ,
    WRITE,
    DELETE,
}

internal enum class ProjectEntity(val configValue: String) {
    PROJECTS("projects"),
    MEMBERS("members"),
    DESIGN_SYSTEMS("design-systems"),
    TENANTS("tenants"),
    TENANTS_SUBTHEMES("tenants:subthemes"),
    TOKENS("tokens"),
    TOKENS_GROUP("tokens:group"),
    TOKENS_SUBGROUP("tokens:subgroup"),
    COMPONENTS("components"),
    COMPONENTS_VARIATIONS("components:variations"),
    ;

    companion object {
        fun fromConfigValue(value: String): ProjectEntity? =
            entries.firstOrNull { it.configValue == value }
    }
}

internal data class AccessKeyScope(
    val entity: ProjectEntity,
    val action: AccessKeyAction,
) {
    val value: String = "${entity.configValue}:${action.name.lowercase()}"

    companion object {
        fun parse(rawValue: String): AccessKeyScope? =
            rawValue.trim()
                .split(':')
                .takeIf { it.size >= 2 }
                ?.let { parts ->
                    val action = AccessKeyAction.entries.firstOrNull {
                        it.name.equals(parts.last(), ignoreCase = true)
                    }
                    val entity = ProjectEntity.fromConfigValue(parts.dropLast(1).joinToString(":"))
                    if (action != null && entity != null) {
                        AccessKeyScope(entity = entity, action = action)
                    } else {
                        null
                    }
                }
    }
}

internal enum class ProjectAccessKeyStatus {
    ACTIVE,
    REVOKED,
}

internal data class ProjectAccessKey(
    val id: String,
    val projectId: String,
    val name: String,
    val scopes: Set<AccessKeyScope>,
    val secretHash: String,
    val createdByUserId: String,
    val expiresAt: Instant?,
    val revokedAt: Instant?,
    val lastUsedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
