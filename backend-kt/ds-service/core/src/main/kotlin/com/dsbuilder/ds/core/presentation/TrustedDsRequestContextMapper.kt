package com.dsbuilder.ds.core.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.TrustedProjectPrincipalFactory
import com.dsbuilder.ds.core.application.DsPublicReadKind
import com.dsbuilder.ds.core.application.DsReadOperation
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.PublicReadCandidate
import com.dsbuilder.ds.core.domain.ProjectId
import io.ktor.http.Headers
import java.util.UUID

/** Converts normalized trusted gateway headers into the shared request context. */
object TrustedDsRequestContextMapper {
    /** Maps trusted [headers] through authorization-core or returns null on invalid input. */
    @Suppress("ReturnCount")
    fun map(headers: Headers, evaluator: PolicyEvaluator, versionId: String? = null): DsRequestContext? {
        if (headers["X-DS-Public-Read"] == "true") return publicContext(headers)
        val principal = TrustedProjectPrincipalFactory.create(
            actorType = headers[ACTOR_TYPE_HEADER],
            projectId = headers[PROJECT_ID_HEADER],
            userId = headers[USER_ID_HEADER],
            projectKeyId = headers[PROJECT_KEY_ID_HEADER],
            projectRole = headers[PROJECT_ROLE_HEADER],
            projectScopes = headers[PROJECT_SCOPES_HEADER],
            systemAdmin = headers[SYSTEM_ADMIN_HEADER],
            policy = evaluator.policy,
            personalAccessTokenId = headers["X-Personal-Access-Token-Id"],
            composePreviewPublisher = headers[COMPOSE_PREVIEW_PUBLISHER_HEADER],
        ) ?: return null
        val correlationId = headers[CORRELATION_ID_HEADER]?.takeIf(String::isNotBlank) ?: UUID.randomUUID().toString()
        val baseRevision = headers.revision(BASE_REVISION_HEADER) { return null }
        val parsedVersionId = (versionId ?: headers["X-DS-Read-Version-Id"])?.let {
            runCatching { UUID.fromString(it) }.getOrNull() ?: return null
        }
        val clientId = headers[CLIENT_ID_HEADER]?.takeIf { it.isNotBlank() && it.length <= MAX_CLIENT_ID_LENGTH }
        if (headers[CLIENT_ID_HEADER] != null && clientId == null) return null
        val coreRevision = headers.revision("X-DS-Core-Selection-Revision") { return null }
        return DsRequestContext(
            principal,
            correlationId,
            baseRevision,
            parsedVersionId,
            clientId,
            designSystemId = headers[DESIGN_SYSTEM_CONTEXT_HEADER]?.let(UUID::fromString),
            expectedCoreSelectionRevision = coreRevision,
            version = headers["X-DS-Read-Version"],
        )
    }

    @Suppress("ReturnCount") // Обязательные доверенные поля отклоняются сразу, без частичного контекста.
    private fun publicContext(headers: Headers): DsRequestContext? {
        val project = headers[PROJECT_ID_HEADER]?.takeIf(String::isNotBlank) ?: return null
        val id = headers[DESIGN_SYSTEM_CONTEXT_HEADER]?.let {
            runCatching { UUID.fromString(it) }.getOrNull()
        } ?: return null
        val kind = headers["X-DS-Public-Kind"]?.let {
            runCatching { DsPublicReadKind.valueOf(it) }.getOrNull()
        } ?: return null
        val operation = DsReadOperation(
            headers["X-DS-Public-Method"] ?: return null,
            headers["X-DS-Public-Path"] ?: return null,
            headers["X-DS-Public-Permission"] ?: return null,
            kind,
        )
        val candidate = PublicReadCandidate(
            ProjectId(project),
            id,
            operation,
            headers[USER_ID_HEADER],
        )
        return DsRequestContext(
            candidate,
            headers[CORRELATION_ID_HEADER] ?: UUID.randomUUID().toString(),
            designSystemId = id,
            version = headers["X-DS-Read-Version"],
            versionId = headers["X-DS-Read-Version-Id"]?.let { UUID.fromString(it) },
        )
    }

    private inline fun Headers.revision(name: String, invalid: () -> Nothing): Long? {
        val raw = this[name] ?: return null
        return raw.toLongOrNull()?.takeIf { it >= 0 } ?: invalid()
    }

    private const val ACTOR_TYPE_HEADER = "X-Actor-Type"
    private const val PROJECT_ID_HEADER = "X-Project-Id"
    private const val USER_ID_HEADER = "X-User-Id"
    private const val PROJECT_KEY_ID_HEADER = "X-Project-Key-Id"
    private const val PROJECT_ROLE_HEADER = "X-Project-Role"
    private const val PROJECT_SCOPES_HEADER = "X-Project-Scopes"
    private const val SYSTEM_ADMIN_HEADER = "X-System-Admin"
    private const val COMPOSE_PREVIEW_PUBLISHER_HEADER = "X-Compose-Preview-Publisher"
    private const val CORRELATION_ID_HEADER = "X-Correlation-Id"
    private const val BASE_REVISION_HEADER = "X-DS-Base-Revision"
    private const val CLIENT_ID_HEADER = "X-DS-Client-Id"
    private const val MAX_CLIENT_ID_LENGTH = 128
}
