package com.dsbuilder.authorization

/** HTTP-independent parser for normalized trusted Gateway header values. */
object TrustedProjectPrincipalFactory {
    /** Returns null for incomplete, malformed or contradictory trusted context. */
    @Suppress("LongParameterList")
    fun create(
        actorType: String?,
        projectId: String?,
        userId: String?,
        projectKeyId: String?,
        projectRole: String?,
        projectScopes: String?,
        systemAdmin: String?,
        policy: AuthorizationPolicy,
    ): ProjectPrincipal? {
        val type = when (actorType?.lowercase()) {
            "user" -> ProjectActorType.USER
            "project_key" -> ProjectActorType.PROJECT_KEY
            else -> return null
        }
        val admin = systemAdmin?.toBooleanStrictOrNull() ?: false
        if (systemAdmin != null && systemAdmin.toBooleanStrictOrNull() == null) return null
        val scopes = projectScopes.orEmpty().split(',').map(String::trim).filter(String::isNotBlank).toSet()
        val principal = when (type) {
            ProjectActorType.USER -> createUser(userId, projectId, projectKeyId, projectRole, scopes, admin)
            ProjectActorType.PROJECT_KEY -> createProjectKey(
                userId,
                projectId,
                projectKeyId,
                projectRole,
                scopes,
                admin,
            )
        }
        return principal?.takeIf { it.isValid(policy) }
    }

    private fun createUser(
        userId: String?,
        projectId: String?,
        projectKeyId: String?,
        projectRole: String?,
        scopes: Set<String>,
        admin: Boolean,
    ): ProjectPrincipal? {
        if (!projectKeyId.isNullOrBlank() || scopes.isNotEmpty()) return null
        return ProjectPrincipal(
            ProjectActorType.USER,
            userId.orEmpty(),
            projectId.orEmpty(),
            projectRole?.lowercase(),
            systemAdmin = admin,
        )
    }

    private fun createProjectKey(
        userId: String?,
        projectId: String?,
        projectKeyId: String?,
        projectRole: String?,
        scopes: Set<String>,
        admin: Boolean,
    ): ProjectPrincipal? {
        val userIdContradictsKey = !userId.isNullOrBlank() && userId != projectKeyId
        if (userIdContradictsKey || !projectRole.isNullOrBlank() || admin) return null
        return ProjectPrincipal(
            ProjectActorType.PROJECT_KEY,
            projectKeyId.orEmpty(),
            projectId.orEmpty(),
            projectScopes = scopes,
        )
    }
}
