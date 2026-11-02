package com.dsbuilder.identity.auth.domain.model

/** Тип проверенного контекста авторизации; не принимается из внешних заголовков. */
enum class ActorType(/** Значение доверенного заголовка. */ val headerValue: String) {
    USER("user"),
    PROJECT_KEY("project_key"),
}

/** Тип проверенного контекста авторизации; не принимается из внешних заголовков. */
enum class GlobalRole(/** Значение роли в JWT. */ val tokenValue: String) {
    USER("user"),
    SYSTEM_ADMIN("system_admin"),
    COMPOSE_PREVIEW_PUBLISHER("compose_preview_publisher"),
}

/** Тип проверенного контекста авторизации; не принимается из внешних заголовков. */
enum class ProjectRole(/** Значение доверенного заголовка. */ val headerValue: String) {
    VIEWER("viewer"),
    EDITOR("editor"),
    MAINTAINER("maintainer"),
    OWNER("owner"),
}

/** Тип проверенного контекста авторизации; не принимается из внешних заголовков. */
data class AuthenticatedActor(
    /** Поле проверенного контекста авторизации. */
    val type: ActorType,
    /** Поле проверенного контекста авторизации. */
    val userId: String,
    /** Поле проверенного контекста авторизации. */
    val email: String?,
    /** Поле проверенного контекста авторизации. */
    val globalRoles: Set<GlobalRole>,
) {
    /** Поле проверенного контекста авторизации. */
    val isSystemAdmin: Boolean = GlobalRole.SYSTEM_ADMIN in globalRoles

    /** Поле проверенного контекста авторизации. */
    val isComposePreviewPublisher: Boolean = GlobalRole.COMPOSE_PREVIEW_PUBLISHER in globalRoles
}

/** Тип проверенного контекста авторизации; не принимается из внешних заголовков. */
data class ProjectContext(
    /** Поле проверенного контекста авторизации. */
    val projectId: String,
    /** Поле проверенного контекста авторизации. */
    val projectRole: ProjectRole,
)

/** Тип проверенного контекста авторизации; не принимается из внешних заголовков. */
data class TrustedHeaders(
    /** Поле проверенного контекста авторизации. */
    val actorType: String,
    /** Поле проверенного контекста авторизации. */
    val userId: String,
    /** Поле проверенного контекста авторизации. */
    val projectId: String? = null,
    /** Поле проверенного контекста авторизации. */
    val projectRole: String? = null,
    /** Поле проверенного контекста авторизации. */
    val projectKeyId: String? = null,
    /** Поле проверенного контекста авторизации. */
    val projectScopes: String? = null,
    /** Поле проверенного контекста авторизации. */
    val systemAdmin: String,
    /** Поле проверенного контекста авторизации. */
    val composePreviewPublisher: String = false.toString(),
) {
    /** Возвращает нормализованные поля проверенного контекста для адаптера представления. */
    fun asMap(): Map<String, String> =
        buildMap {
            put(HEADER_ACTOR_TYPE, actorType)
            put(HEADER_USER_ID, userId)
            projectId?.let { put(HEADER_PROJECT_ID, it) }
            projectRole?.let { put(HEADER_PROJECT_ROLE, it) }
            projectKeyId?.let { put(HEADER_PROJECT_KEY_ID, it) }
            projectScopes?.let { put(HEADER_PROJECT_SCOPES, it) }
            put(HEADER_SYSTEM_ADMIN, systemAdmin)
            put(HEADER_COMPOSE_PREVIEW_PUBLISHER, composePreviewPublisher)
        }

    companion object {
        /** Имя нормализованного поля контекста. */
        const val HEADER_ACTOR_TYPE = "X-Actor-Type"

        /** Имя нормализованного поля контекста. */
        const val HEADER_USER_ID = "X-User-Id"

        /** Имя нормализованного поля контекста. */
        const val HEADER_PROJECT_ID = "X-Project-Id"

        /** Имя нормализованного поля контекста. */
        const val HEADER_PROJECT_ROLE = "X-Project-Role"

        /** Имя нормализованного поля контекста. */
        const val HEADER_PROJECT_KEY_ID = "X-Project-Key-Id"

        /** Имя нормализованного поля контекста. */
        const val HEADER_PROJECT_SCOPES = "X-Project-Scopes"

        /** Имя нормализованного поля контекста. */
        const val HEADER_SYSTEM_ADMIN = "X-System-Admin"

        /** Имя нормализованного поля контекста. */
        const val HEADER_COMPOSE_PREVIEW_PUBLISHER = "X-Compose-Preview-Publisher"
    }
}
