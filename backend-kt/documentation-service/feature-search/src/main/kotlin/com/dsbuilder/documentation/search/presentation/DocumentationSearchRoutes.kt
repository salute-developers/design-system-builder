@file:Suppress("MatchingDeclarationName")

package com.dsbuilder.documentation.search.presentation

import com.dsbuilder.documentation.search.application.DocumentationSearchOutcome
import com.dsbuilder.documentation.search.application.DocumentationSearchRequest
import com.dsbuilder.documentation.search.application.FetchKnowledgeChunkUseCase
import com.dsbuilder.documentation.search.application.SearchDocumentationUseCase
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/** HTTP limits private documentation search. */
data class DocumentationSearchLimits(
    /** Default page size. */ val defaultLimit: Int = 20,
    /** Maximum page size. */ val maxLimit: Int = 100,
    /** Maximum UTF-8 query bytes. */ val maxQueryBytes: Int = 1024,
    /** Maximum subject filters. */ val maxSubjects: Int = 50,
    /** Maximum offset cursor, ограничивающий размер candidate window. */ val maxCursor: Int = 1_000,
)

/** Регистрирует private project-scoped search и knowledge fetch endpoints. */
@Suppress("CyclomaticComplexMethod")
fun Route.documentationSearchRoutes(
    search: SearchDocumentationUseCase,
    fetch: FetchKnowledgeChunkUseCase,
    limits: DocumentationSearchLimits = DocumentationSearchLimits(),
) {
    get("/documentation/search") {
        val projectId = call.request.headers[PROJECT_ID_HEADER]
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val parameters = call.request.queryParameters
        val designSystemId = parameters["designSystemId"].nonBlank()
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val version = parameters["version"].nonBlank()
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val platform = parameters["platform"].nonBlank()
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val query = parameters["query"].nonBlank()
            ?.takeIf { it.encodeToByteArray().size <= limits.maxQueryBytes }
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val subjects = parameters.getAll("subject").orEmpty().filter(String::isNotBlank).toSet()
        if (subjects.size > limits.maxSubjects) return@get call.respond(HttpStatusCode.BadRequest)
        val cursor = parameters["cursor"]?.toIntOrNull() ?: 0
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
                ),
            )
        ) {
            is DocumentationSearchOutcome.Found -> call.respond(outcome.page)
            DocumentationSearchOutcome.InvalidQuery -> call.respond(HttpStatusCode.BadRequest)
            DocumentationSearchOutcome.PublicationNotFound -> call.respond(HttpStatusCode.NotFound)
        }
    }
    get("/documentation/kb/fetch") {
        val projectId = call.request.headers[PROJECT_ID_HEADER]
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val url = call.request.queryParameters["url"].nonBlank()
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        fetch.execute(projectId, url)?.let { call.respond(it) }
            ?: call.respond(HttpStatusCode.NotFound)
    }
}

private fun String?.nonBlank(): String? = this?.takeIf(String::isNotBlank)

private const val PROJECT_ID_HEADER = "X-Project-Id"
