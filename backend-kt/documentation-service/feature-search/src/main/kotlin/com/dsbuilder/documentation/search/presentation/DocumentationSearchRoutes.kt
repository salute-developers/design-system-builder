@file:Suppress("MatchingDeclarationName")

package com.dsbuilder.documentation.search.presentation

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.authorization.TrustedProjectPrincipalFactory
import com.dsbuilder.documentation.search.application.DocumentationSearchOutcome
import com.dsbuilder.documentation.search.application.DocumentationSearchRequest
import com.dsbuilder.documentation.search.application.FetchKnowledgeChunkUseCase
import com.dsbuilder.documentation.search.application.SearchDocumentationUseCase
import com.dsbuilder.documentation.search.application.SearchPublication
import com.dsbuilder.documentation.search.application.compact
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** HTTP limits private documentation search. */
data class DocumentationSearchLimits(
    /** Default page size. */ val defaultLimit: Int = 20,
    /** Maximum page size. */ val maxLimit: Int = 100,
    /** Maximum UTF-8 query bytes. */ val maxQueryBytes: Int = 1024,
    /** Maximum subject filters. */ val maxSubjects: Int = 50,
    /** Maximum offset cursor, ограничивающий размер candidate window. */ val maxCursor: Int = 1_000,
)

/** Регистрирует private project-scoped search и knowledge fetch endpoints. */
@Suppress("CyclomaticComplexMethod", "LongMethod")
fun Route.documentationSearchRoutes(
    search: SearchDocumentationUseCase,
    fetch: FetchKnowledgeChunkUseCase,
    limits: DocumentationSearchLimits = DocumentationSearchLimits(),
    evaluator: PolicyEvaluator = PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()),
) {
    get(searchRoutePath("/documentation/search")) {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val parameters = call.request.queryParameters
        val designSystemId = parameters["designSystemId"].nonBlank()
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val publicationId = parameters["publicationId"].nonBlank()
        val version = parameters["version"].nonBlank()
            ?: if (publicationId != null) "" else return@get call.respond(HttpStatusCode.BadRequest)
        val platform = parameters["platform"].nonBlank()
            ?: if (publicationId != null) "" else return@get call.respond(HttpStatusCode.BadRequest)
        val query = parameters["query"].nonBlank()
            ?.takeIf { it.encodeToByteArray().size <= limits.maxQueryBytes }
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val subjects = parameters.getAll("subject").orEmpty().filter(String::isNotBlank).toSet()
        if (subjects.size > limits.maxSubjects) return@get call.respond(HttpStatusCode.BadRequest)
        val cursor = parameters["cursor"]?.let {
            it.toIntOrNull() ?: return@get call.respond(HttpStatusCode.BadRequest)
        } ?: 0
        if (cursor !in 0..limits.maxCursor) return@get call.respond(HttpStatusCode.BadRequest)
        val requestedLimit = parameters["limit"]?.toIntOrNull() ?: limits.defaultLimit
        val limit = requestedLimit.coerceIn(1, limits.maxLimit)
        when (
            val outcome = search.execute(
                DocumentationSearchRequest(
                    projectId,
                    designSystemId,
                    version,
                    platform,
                    query,
                    subjects,
                    cursor,
                    limit,
                    publicationId,
                ),
            )
        ) {
            is DocumentationSearchOutcome.Found -> {
                call.response.headers.append("X-DS-Read-Context", searchReadContext(outcome.publication))
                call.respond(outcome.page)
            }
            DocumentationSearchOutcome.InvalidQuery -> call.respond(HttpStatusCode.BadRequest)
            DocumentationSearchOutcome.PublicationNotFound -> call.respond(HttpStatusCode.NotFound)
        }
    }
    get(searchRoutePath("/documentation/kb/fetch")) {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val url = call.request.queryParameters["url"].nonBlank()
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val detail = call.request.queryParameters["detail"]
        if (detail != null && detail !in setOf("full", "compact")) {
            return@get call.respond(HttpStatusCode.BadRequest)
        }
        fetch.execute(projectId, url)?.let {
            call.response.headers.append(
                "X-DS-Read-Context",
                buildJsonObject {
                    put("designSystemId", it.designSystemId)
                    put("version", it.version)
                    put("platform", it.platform)
                    put("publicationId", it.publicationId)
                }.toString(),
            )
            call.respond(if (detail == "compact") it.compact() else it)
        }
            ?: call.respond(HttpStatusCode.NotFound)
    }
}

private fun String?.nonBlank(): String? = this?.takeIf(String::isNotBlank)

private fun searchReadContext(publication: SearchPublication): String = buildJsonObject {
    put("designSystemId", publication.designSystemId)
    put("version", publication.version)
    put("platform", publication.platform)
    put("publicationId", publication.publicationId)
}.toString()

private suspend fun ApplicationCall.requireDocumentationRead(evaluator: PolicyEvaluator): ProjectPrincipal? {
    val principal = trustedPrincipal(evaluator) ?: run {
        respond(HttpStatusCode.BadRequest)
        return null
    }
    if (!evaluator.isAllowed(principal, DOCUMENTATION_READ)) {
        respond(HttpStatusCode.Forbidden)
        return null
    }
    return principal
}

private fun ApplicationCall.trustedPrincipal(evaluator: PolicyEvaluator): ProjectPrincipal? {
    return TrustedProjectPrincipalFactory.create(
        actorType = searchTrustedHeaders()[ACTOR_TYPE_HEADER],
        projectId = searchTrustedHeaders()[PROJECT_ID_HEADER],
        userId = searchTrustedHeaders()[USER_ID_HEADER],
        projectKeyId = searchTrustedHeaders()[PROJECT_KEY_ID_HEADER],
        projectRole = searchTrustedHeaders()[PROJECT_ROLE_HEADER],
        projectScopes = searchTrustedHeaders()[PROJECT_SCOPES_HEADER],
        systemAdmin = searchTrustedHeaders()[SYSTEM_ADMIN_HEADER],
        policy = evaluator.policy,
    )
}

private const val PROJECT_ID_HEADER = "X-Project-Id"
private const val ACTOR_TYPE_HEADER = "X-Actor-Type"
private const val USER_ID_HEADER = "X-User-Id"
private const val PROJECT_KEY_ID_HEADER = "X-Project-Key-Id"
private const val PROJECT_ROLE_HEADER = "X-Project-Role"
private const val PROJECT_SCOPES_HEADER = "X-Project-Scopes"
private const val SYSTEM_ADMIN_HEADER = "X-System-Admin"
private const val DOCUMENTATION_READ = "documentation:read"
