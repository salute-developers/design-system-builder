package com.dsbuilder.documentation.publication.presentation

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.authorization.TrustedProjectPrincipalFactory
import com.dsbuilder.documentation.publication.application.ActivePublicationDto
import com.dsbuilder.documentation.publication.application.AssetContentReader
import com.dsbuilder.documentation.publication.application.BindingQuery
import com.dsbuilder.documentation.publication.application.BindingSummaryPageDto
import com.dsbuilder.documentation.publication.application.CodeBindingProjection
import com.dsbuilder.documentation.publication.application.PublicationListQuery
import com.dsbuilder.documentation.publication.application.PublicationReadRepository
import com.dsbuilder.documentation.publication.application.summary
import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.response.respondOutputStream
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Регистрирует project-scoped internal read endpoints. */
@Suppress("CyclomaticComplexMethod", "LongMethod")
fun Route.publicationReadRoutes(
    repository: PublicationReadRepository,
    assets: AssetContentReader? = null,
    evaluator: PolicyEvaluator = PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()),
) {
    get(publicationRoutePath("/documentation/ingestion-jobs/{jobId}")) {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val jobId = call.parameters["jobId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        repository.ingestionJob(projectId, jobId)?.let { call.respond(it) }
            ?: call.respond(HttpStatusCode.NotFound)
    }
    get(publicationRoutePath("/documentation/publications/active")) {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val designSystemId = call.request.queryParameters["designSystemId"]
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val version = call.request.queryParameters["version"]
        val platform = call.request.queryParameters["platform"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        repository.activePublication(projectId, designSystemId, version, platform)?.let {
            call.appendReadContext(it)
            call.respond(it)
        }
            ?: call.respond(HttpStatusCode.NotFound)
    }
    get(publicationRoutePath("/documentation/publications")) {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val parameters = call.request.queryParameters
        val designSystemId = parameters["designSystemId"]?.takeIf(String::isNotBlank)
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val limit = parameters["limit"]?.toIntOrNull() ?: DEFAULT_LIMIT
        if (limit !in 1..MAX_LIMIT || (parameters["limit"] != null && parameters["limit"]?.toIntOrNull() == null)) {
            return@get call.respond(HttpStatusCode.BadRequest)
        }
        val query = PublicationListQuery(
            designSystemId,
            parameters["version"],
            parameters["platform"],
            limit,
            parameters["cursor"],
        )
        repository.publications(projectId, query)?.let {
            call.response.headers.append(
                "X-DS-Read-Context",
                buildJsonObject {
                    put("designSystemId", designSystemId)
                }.toString(),
            )
            call.respond(it)
        }
            ?: call.respond(HttpStatusCode.BadRequest)
    }
    get(publicationRoutePath("/documentation/publications/{publicationId}/navigation")) {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val publicationId = call.parameters["publicationId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        val publication = repository.publication(projectId, publicationId)
            ?: return@get call.respond(HttpStatusCode.NotFound)
        call.appendReadContext(publication)
        repository.navigation(projectId, publicationId)?.let { call.respond(it) }
            ?: call.respond(HttpStatusCode.NotFound)
    }
    get(publicationRoutePath("/documentation/publications/{publicationId}/pages/{path...}")) {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val publicationId = call.parameters["publicationId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        val publication = repository.publication(projectId, publicationId)
            ?: return@get call.respond(HttpStatusCode.NotFound)
        val path = call.parameters.getAll("path")?.joinToString("/")
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        call.appendReadContext(publication)
        repository.page(projectId, publicationId, path)?.let { call.respond(it) }
            ?: call.respond(HttpStatusCode.NotFound)
    }
    get(publicationRoutePath("/documentation/publications/{publicationId}/bindings/{bindingId}")) {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val publicationId = call.parameters["publicationId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        val publication = repository.publication(projectId, publicationId)
            ?: return@get call.respond(HttpStatusCode.NotFound)
        val bindingId = call.parameters["bindingId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        call.appendReadContext(publication)
        val parameters = call.request.queryParameters
        val appearanceNames = parameters.getAll("appearanceNames").orEmpty().filter(String::isNotBlank).toSet()
        val variationNames = parameters.getAll("variationNames").orEmpty().filter(String::isNotBlank).toSet()
        val detail = parameters["detail"] ?: if (variationNames.isNotEmpty()) "variations" else "full"
        if (detail !in setOf("summary", "variations", "full") ||
            (detail == "summary" && variationNames.isNotEmpty())
        ) {
            return@get call.respond(HttpStatusCode.BadRequest)
        }
        repository.binding(projectId, publicationId, bindingId)?.let { binding ->
            CodeBindingProjection.project(binding, detail, appearanceNames, variationNames)?.let { call.respond(it) }
                ?: call.respond(HttpStatusCode.UnprocessableEntity)
        }
            ?: call.respond(HttpStatusCode.NotFound)
    }
    get(publicationRoutePath("/documentation/publications/{publicationId}/bindings")) {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val publicationId = call.parameters["publicationId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        val publication = repository.publication(projectId, publicationId)
            ?: return@get call.respond(HttpStatusCode.NotFound)
        val parameters = call.request.queryParameters
        call.appendReadContext(publication)
        val detail = parameters["detail"] ?: "full"
        if (detail !in setOf("summary", "full") ||
            (parameters["name"] != null && parameters["exactName"] != null)
        ) {
            return@get call.respond(HttpStatusCode.BadRequest)
        }
        val limit = parameters["limit"]?.let {
            it.toIntOrNull()?.takeIf { value -> value in 1..MAX_LIMIT }
                ?: return@get call.respond(HttpStatusCode.BadRequest)
        } ?: DEFAULT_LIMIT
        val query = BindingQuery(
            call.request.queryParameters["cursor"],
            call.request.queryParameters["subject"],
            call.request.queryParameters["kind"],
            call.request.queryParameters["name"],
            limit,
            parameters["exactName"],
        )
        repository.bindings(projectId, publicationId, query)?.let { page ->
            if (detail == "summary") {
                call.respond(BindingSummaryPageDto(page.items.map { it.summary() }, page.nextCursor))
            } else {
                call.respond(page)
            }
        }
            ?: call.respond(HttpStatusCode.BadRequest)
    }
    get(publicationRoutePath("/documentation/publications/{publicationId}/assets/{assetId}")) {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val publicationId = call.parameters["publicationId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        val publication = repository.publication(projectId, publicationId)
            ?: return@get call.respond(HttpStatusCode.NotFound)
        val assetId = call.parameters["assetId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        val asset = repository.asset(projectId, publicationId, assetId)
            ?: return@get call.respond(HttpStatusCode.NotFound)
        val reader = assets ?: return@get call.respond(HttpStatusCode.ServiceUnavailable)
        call.appendReadContext(publication)
        call.response.headers.append("ETag", asset.sha256)
        call.response.headers.append("Content-Length", asset.size.toString())
        call.response.headers.append(X_CONTENT_TYPE_OPTIONS, "nosniff")
        val declaredContentType = runCatching { ContentType.parse(asset.mediaType) }
            .getOrDefault(ContentType.Application.OctetStream)
        val contentType = if (declaredContentType.isSafeInlineAsset()) {
            declaredContentType
        } else {
            val fileName = asset.path.substringAfterLast('/').ifBlank { "asset" }
            call.response.headers.append(
                HttpHeaders.ContentDisposition,
                ContentDisposition.Attachment.withParameter(
                    ContentDisposition.Parameters.FileName,
                    fileName,
                ).toString(),
            )
            ContentType.Application.OctetStream
        }
        call.respondOutputStream(contentType, HttpStatusCode.OK) { reader.copyTo(asset.storageKey, this) }
    }
}

private fun ApplicationCall.appendReadContext(publication: ActivePublicationDto) {
    response.headers.append(
        "X-DS-Read-Context",
        buildJsonObject {
            put("designSystemId", publication.designSystemId)
            put("version", publication.version)
            put("platform", publication.platform)
            put("publicationId", publication.publicationId)
        }.toString(),
    )
}

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
        actorType = publicationTrustedHeaders()[ACTOR_TYPE_HEADER],
        projectId = publicationTrustedHeaders()[PROJECT_ID_HEADER],
        userId = publicationTrustedHeaders()[USER_ID_HEADER],
        projectKeyId = publicationTrustedHeaders()[PROJECT_KEY_ID_HEADER],
        projectRole = publicationTrustedHeaders()[PROJECT_ROLE_HEADER],
        projectScopes = publicationTrustedHeaders()[PROJECT_SCOPES_HEADER],
        systemAdmin = publicationTrustedHeaders()[SYSTEM_ADMIN_HEADER],
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
private const val DEFAULT_LIMIT = 20
private const val MAX_LIMIT = 100

private fun ContentType.isSafeInlineAsset(): Boolean = withoutParameters() in SAFE_INLINE_ASSET_TYPES

private val SAFE_INLINE_ASSET_TYPES = setOf(
    ContentType.Image.PNG,
    ContentType.Image.JPEG,
    ContentType.Image.GIF,
    ContentType("image", "webp"),
    ContentType("image", "avif"),
    ContentType("audio", "mpeg"),
    ContentType("audio", "ogg"),
    ContentType("audio", "wav"),
    ContentType("video", "mp4"),
    ContentType("video", "webm"),
)

private const val X_CONTENT_TYPE_OPTIONS = "X-Content-Type-Options"
