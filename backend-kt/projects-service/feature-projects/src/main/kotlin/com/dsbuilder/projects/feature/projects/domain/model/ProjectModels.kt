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
    val personalAccessTokenId: String? = null,
    val scopes: Set<TokenScope> = emptySet(),
)

internal enum class ActorType {
    USER,
    PERSONAL_ACCESS_TOKEN,
}

internal enum class TokenAction {
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

internal data class TokenScope(val value: String) {
    constructor(entity: ProjectEntity, action: TokenAction) :
        this("${entity.configValue}:${action.name.lowercase()}")

    companion object {
        fun parse(rawValue: String): TokenScope? =
            rawValue.trim().lowercase().takeIf { it.matches(SCOPE_PATTERN) }?.let(::TokenScope)

        private val SCOPE_PATTERN = Regex("^[a-z][a-z0-9_-]*(?::[a-z][a-z0-9_-]*)+$")
    }
}
