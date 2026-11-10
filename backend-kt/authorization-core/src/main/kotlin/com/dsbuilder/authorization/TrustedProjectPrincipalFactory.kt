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
        composePreviewPublisher: String? = null,
        personalAccessTokenId: String? = null,
    ): ProjectPrincipal? {
        val type = when (actorType?.lowercase()) {
            "user" -> ProjectActorType.USER
            "personal_access_token" -> ProjectActorType.PERSONAL_ACCESS_TOKEN
            else -> return null
        }
        val admin = parseFlag(systemAdmin)
        val publisher = parseFlag(composePreviewPublisher)
        if (admin == null || publisher == null) return null
        val scopes = projectScopes.orEmpty().split(',').map(String::trim).filter(String::isNotBlank).toSet()
        val principal = when (type) {
            ProjectActorType.PERSONAL_ACCESS_TOKEN -> {
                if (!projectKeyId.isNullOrBlank() || publisher) {
                    null
                } else {
                    ProjectPrincipal(
                        type,
                        userId.orEmpty(),
                        projectId.orEmpty(),
                        projectRole?.lowercase(),
                        scopes,
                        admin,
                        personalAccessTokenId = personalAccessTokenId,
                    )
                }
            }
            ProjectActorType.USER -> createUser(userId, projectId, projectKeyId, projectRole, scopes, admin, publisher)
        }
        return principal?.takeIf { it.isValid(policy) }
    }

    /** An absent flag is false; a present but non-boolean value is malformed and yields null. */
    private fun parseFlag(value: String?): Boolean? = if (value == null) false else value.toBooleanStrictOrNull()

    private fun createUser(
        userId: String?,
        projectId: String?,
        projectKeyId: String?,
        projectRole: String?,
        scopes: Set<String>,
        admin: Boolean,
        publisher: Boolean,
    ): ProjectPrincipal? {
        if (!projectKeyId.isNullOrBlank() || scopes.isNotEmpty()) return null
        return ProjectPrincipal(
            ProjectActorType.USER,
            userId.orEmpty(),
            projectId.orEmpty(),
            projectRole?.lowercase(),
            systemAdmin = admin,
            composePreviewPublisher = publisher,
        )
    }
}
