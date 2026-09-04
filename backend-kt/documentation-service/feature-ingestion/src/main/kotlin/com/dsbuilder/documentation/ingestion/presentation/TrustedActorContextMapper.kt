package com.dsbuilder.documentation.ingestion.presentation

import com.dsbuilder.documentation.ingestion.domain.ActorContext
import com.dsbuilder.documentation.ingestion.domain.ActorType
import io.ktor.http.Headers

/** Преобразует trusted gateway headers в application context. */
object TrustedActorContextMapper {
    /** Возвращает null при отсутствии или противоречивости trusted context. */
    fun map(headers: Headers): ActorContext? {
        val type = headers[ACTOR_TYPE_HEADER]?.lowercase().toActorType()
        val projectId = headers[PROJECT_ID_HEADER]?.takeIf(String::isNotBlank)
        return if (type == null || projectId == null) null else context(type, projectId, headers)
    }

    private fun context(type: ActorType, projectId: String, headers: Headers): ActorContext? {
        val actorIdHeader = if (type == ActorType.USER) USER_ID_HEADER else PROJECT_KEY_ID_HEADER
        val actorId = headers[actorIdHeader]?.takeIf(String::isNotBlank) ?: return null
        return when (type) {
            ActorType.USER -> userContext(actorId, projectId, headers)
            ActorType.PROJECT_KEY -> projectKeyContext(actorId, projectId, headers)
        }
    }

    private fun userContext(actorId: String, projectId: String, headers: Headers) = ActorContext(
        ActorType.USER,
        actorId,
        projectId,
        headers[PROJECT_ROLE_HEADER],
        systemAdmin = headers[SYSTEM_ADMIN_HEADER].toBoolean(),
    )

    private fun projectKeyContext(actorId: String, projectId: String, headers: Headers) = ActorContext(
        ActorType.PROJECT_KEY,
        actorId,
        projectId,
        projectScopes = headers[PROJECT_SCOPES_HEADER]
            .orEmpty()
            .split(SCOPE_SEPARATOR)
            .filter(String::isNotBlank)
            .toSet(),
    )

    private fun String?.toActorType(): ActorType? = when (this) {
        USER_ACTOR_TYPE -> ActorType.USER
        PROJECT_KEY_ACTOR_TYPE -> ActorType.PROJECT_KEY
        else -> null
    }

    private const val USER_ACTOR_TYPE = "user"
    private const val PROJECT_KEY_ACTOR_TYPE = "project_key"
    private const val ACTOR_TYPE_HEADER = "X-Actor-Type"
    private const val PROJECT_ID_HEADER = "X-Project-Id"
    private const val USER_ID_HEADER = "X-User-Id"
    private const val PROJECT_KEY_ID_HEADER = "X-Project-Key-Id"
    private const val PROJECT_ROLE_HEADER = "X-Project-Role"
    private const val SYSTEM_ADMIN_HEADER = "X-System-Admin"
    private const val PROJECT_SCOPES_HEADER = "X-Project-Scopes"
    private const val SCOPE_SEPARATOR = ','
}
