package com.dsbuilder.ds.core.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.TrustedProjectPrincipalFactory
import com.dsbuilder.ds.core.application.DsRequestContext
import io.ktor.http.Headers
import java.util.UUID

/** Converts normalized trusted gateway headers into the shared request context. */
object TrustedDsRequestContextMapper {
    /** Maps trusted [headers] through authorization-core or returns null on invalid input. */
    fun map(headers: Headers, evaluator: PolicyEvaluator): DsRequestContext? {
        val principal = TrustedProjectPrincipalFactory.create(
            actorType = headers[ACTOR_TYPE_HEADER],
            projectId = headers[PROJECT_ID_HEADER],
            userId = headers[USER_ID_HEADER],
            projectKeyId = headers[PROJECT_KEY_ID_HEADER],
            projectRole = headers[PROJECT_ROLE_HEADER],
            projectScopes = headers[PROJECT_SCOPES_HEADER],
            systemAdmin = headers[SYSTEM_ADMIN_HEADER],
            policy = evaluator.policy,
        ) ?: return null
        val correlationId = headers[CORRELATION_ID_HEADER]?.takeIf(String::isNotBlank) ?: UUID.randomUUID().toString()
        return DsRequestContext(principal, correlationId)
    }

    private const val ACTOR_TYPE_HEADER = "X-Actor-Type"
    private const val PROJECT_ID_HEADER = "X-Project-Id"
    private const val USER_ID_HEADER = "X-User-Id"
    private const val PROJECT_KEY_ID_HEADER = "X-Project-Key-Id"
    private const val PROJECT_ROLE_HEADER = "X-Project-Role"
    private const val PROJECT_SCOPES_HEADER = "X-Project-Scopes"
    private const val SYSTEM_ADMIN_HEADER = "X-System-Admin"
    private const val CORRELATION_ID_HEADER = "X-Correlation-Id"
}
