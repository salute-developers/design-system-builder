package com.dsbuilder.documentation.publication.presentation

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.authorization.TrustedProjectPrincipalFactory
import com.dsbuilder.documentation.publication.application.AssetContentReader
import com.dsbuilder.documentation.publication.application.BindingQuery
import com.dsbuilder.documentation.publication.application.PublicationReadRepository
import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.server.response.respondOutputStream
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/** Регистрирует project-scoped internal read endpoints. */
@Suppress("CyclomaticComplexMethod", "LongMethod")
fun Route.publicationReadRoutes(
    repository: PublicationReadRepository,
    assets: AssetContentReader? = null,
    evaluator: PolicyEvaluator = PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()),
) {
    get("/documentation/ingestion-jobs/{jobId}") {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val jobId = call.parameters["jobId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        repository.ingestionJob(projectId, jobId)?.let { call.respond(it) }
            ?: call.respond(HttpStatusCode.NotFound)
    }
    get("/documentation/publications/active") {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val designSystemId = call.request.queryParameters["designSystemId"]
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        val version = call.request.queryParameters["version"]
        val platform = call.request.queryParameters["platform"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        repository.activePublication(projectId, designSystemId, version, platform)?.let { call.respond(it) }
            ?: call.respond(HttpStatusCode.NotFound)
    }
    get("/documentation/publications/{publicationId}/navigation") {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val publicationId = call.parameters["publicationId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        repository.navigation(projectId, publicationId)?.let { call.respond(it) }
            ?: call.respond(HttpStatusCode.NotFound)
    }
    get("/documentation/publications/{publicationId}/pages/{path...}") {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val publicationId = call.parameters["publicationId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        val path = call.parameters.getAll("path")?.joinToString("/")
            ?: return@get call.respond(HttpStatusCode.BadRequest)
        repository.page(projectId, publicationId, path)?.let { call.respond(it) }
            ?: call.respond(HttpStatusCode.NotFound)
    }
    get("/documentation/publications/{publicationId}/bindings/{bindingId}") {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val publicationId = call.parameters["publicationId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        val bindingId = call.parameters["bindingId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        repository.binding(projectId, publicationId, bindingId)?.let { call.respond(it) }
            ?: call.respond(HttpStatusCode.NotFound)
    }
    get("/documentation/publications/{publicationId}/bindings") {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val publicationId = call.parameters["publicationId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        val limit = call.request.queryParameters["limit"]?.toIntOrNull()?.coerceIn(1, MAX_LIMIT) ?: DEFAULT_LIMIT
        val query = BindingQuery(
            call.request.queryParameters["cursor"],
            call.request.queryParameters["subject"],
            call.request.queryParameters["kind"],
            call.request.queryParameters["name"],
            limit,
        )
        repository.bindings(projectId, publicationId, query)?.let { call.respond(it) }
            ?: call.respond(HttpStatusCode.NotFound)
    }
    get("/documentation/publications/{publicationId}/assets/{assetId}") {
        val projectId = call.requireDocumentationRead(evaluator)?.projectId ?: return@get
        val publicationId = call.parameters["publicationId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        val assetId = call.parameters["assetId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
        val asset = repository.asset(projectId, publicationId, assetId)
            ?: return@get call.respond(HttpStatusCode.NotFound)
        val reader = assets ?: return@get call.respond(HttpStatusCode.ServiceUnavailable)
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
        actorType = request.headers[ACTOR_TYPE_HEADER],
        projectId = request.headers[PROJECT_ID_HEADER],
        userId = request.headers[USER_ID_HEADER],
        projectKeyId = request.headers[PROJECT_KEY_ID_HEADER],
        projectRole = request.headers[PROJECT_ROLE_HEADER],
        projectScopes = request.headers[PROJECT_SCOPES_HEADER],
        systemAdmin = request.headers[SYSTEM_ADMIN_HEADER],
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
