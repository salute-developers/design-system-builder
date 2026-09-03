package com.dsbuilder.identity.auth.domain.model

internal enum class ActorType(val headerValue: String) {
    USER("user"),
    PROJECT_KEY("project_key"),
}

internal enum class GlobalRole(val tokenValue: String) {
    USER("user"),
    SYSTEM_ADMIN("system_admin"),
}

internal enum class ProjectRole(val headerValue: String) {
    VIEWER("viewer"),
    EDITOR("editor"),
    MAINTAINER("maintainer"),
    OWNER("owner"),
}

internal data class AuthenticatedActor(
    val type: ActorType,
    val userId: String,
    val email: String?,
    val globalRoles: Set<GlobalRole>,
) {
    val isSystemAdmin: Boolean = GlobalRole.SYSTEM_ADMIN in globalRoles
}

internal data class ProjectContext(
    val projectId: String,
    val projectRole: ProjectRole,
)

internal data class TrustedHeaders(
    val actorType: String,
    val userId: String,
    val projectId: String? = null,
    val projectRole: String? = null,
    val projectKeyId: String? = null,
    val projectScopes: String? = null,
    val systemAdmin: String,
) {
    fun asMap(): Map<String, String> =
        buildMap {
            put(HEADER_ACTOR_TYPE, actorType)
            put(HEADER_USER_ID, userId)
            projectId?.let { put(HEADER_PROJECT_ID, it) }
            projectRole?.let { put(HEADER_PROJECT_ROLE, it) }
            projectKeyId?.let { put(HEADER_PROJECT_KEY_ID, it) }
            projectScopes?.let { put(HEADER_PROJECT_SCOPES, it) }
            put(HEADER_SYSTEM_ADMIN, systemAdmin)
        }

    companion object {
        const val HEADER_ACTOR_TYPE = "X-Actor-Type"
        const val HEADER_USER_ID = "X-User-Id"
        const val HEADER_PROJECT_ID = "X-Project-Id"
        const val HEADER_PROJECT_ROLE = "X-Project-Role"
        const val HEADER_PROJECT_KEY_ID = "X-Project-Key-Id"
        const val HEADER_PROJECT_SCOPES = "X-Project-Scopes"
        const val HEADER_SYSTEM_ADMIN = "X-System-Admin"
    }
}
