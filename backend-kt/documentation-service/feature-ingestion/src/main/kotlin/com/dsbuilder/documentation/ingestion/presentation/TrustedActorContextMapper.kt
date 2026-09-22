package com.dsbuilder.documentation.ingestion.presentation

import com.dsbuilder.authorization.AuthorizationPolicy
import com.dsbuilder.authorization.TrustedProjectPrincipalFactory
import com.dsbuilder.documentation.ingestion.domain.ActorContext
import io.ktor.http.Headers

/** Преобразует trusted gateway headers в application context. */
object TrustedActorContextMapper {
    /** Возвращает null при отсутствии или противоречивости trusted context. */
    fun map(headers: Headers, policy: AuthorizationPolicy): ActorContext? = TrustedProjectPrincipalFactory.create(
        actorType = headers[ACTOR_TYPE_HEADER],
        projectId = headers[PROJECT_ID_HEADER],
        userId = headers[USER_ID_HEADER],
        projectKeyId = headers[PROJECT_KEY_ID_HEADER],
        projectRole = headers[PROJECT_ROLE_HEADER],
        projectScopes = headers[PROJECT_SCOPES_HEADER],
        systemAdmin = headers[SYSTEM_ADMIN_HEADER],
        policy = policy,
    )

    private const val ACTOR_TYPE_HEADER = "X-Actor-Type"
    private const val PROJECT_ID_HEADER = "X-Project-Id"
    private const val USER_ID_HEADER = "X-User-Id"
    private const val PROJECT_KEY_ID_HEADER = "X-Project-Key-Id"
    private const val PROJECT_ROLE_HEADER = "X-Project-Role"
    private const val SYSTEM_ADMIN_HEADER = "X-System-Admin"
    private const val PROJECT_SCOPES_HEADER = "X-Project-Scopes"
}
