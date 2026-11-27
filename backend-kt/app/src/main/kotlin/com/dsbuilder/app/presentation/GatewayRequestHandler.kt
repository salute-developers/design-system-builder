package com.dsbuilder.app.presentation

import com.dsbuilder.app.GatewayConfiguration
import com.dsbuilder.ds.core.application.DsReadOperation
import com.dsbuilder.ds.core.application.DsReadOperationCatalog
import com.dsbuilder.identity.auth.application.GatewayAuthorizer
import com.dsbuilder.identity.auth.application.usecase.GatewayAuthDecision
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path
import io.ktor.server.response.header
import io.ktor.server.response.respondText
import java.util.UUID

internal class GatewayRequestHandler(
    private val configuration: GatewayConfiguration,
    private val authorizer: GatewayAuthorizer,
    private val publicReads: DsReadOperationCatalog,

) {
    private val pluginCors = PluginCorsPolicy(configuration.pluginOrigins, configuration.realm)

    @Suppress("ReturnCount") // Ограничения входа завершают запрос до предметного обработчика.
    suspend fun validate(call: ApplicationCall): Boolean {
        cors(call)
        val rawPath = call.request.path()
        val rejected = preliminaryStatus(call, rawPath)
        if (rejected != null) {
            reject(call, rejected)
            return false
        }
        val path = java.net.URI(rawPath).path
        if (path == "/api/privacy/analytics/consent") {
            val origin = call.request.headers[HttpHeaders.Origin]
            val allowedOrigin = origin == null || origin == configuration.webOrigin ||
                configuration.webOrigin == null && Regex("http://(localhost|127\\.0\\.0\\.1):[0-9]+").matches(origin)
            if (!allowedOrigin || call.request.httpMethod !in setOf(HttpMethod.Get, HttpMethod.Post)) {
                reject(call, HttpStatusCode.Forbidden)
                return false
            }
        }
        val policy = routePolicy(path)
        if (!acceptBody(call, path, policy)) return false
        if (policy.ds) {
            publicRead(call, path, requireNotNull(policy.projectId))?.let { return it }
        }
        return authorize(call, path, policy.userRoute, policy.projectId)
    }

    private suspend fun publicRead(call: ApplicationCall, path: String, project: String): Boolean? {
        val prefix = "/api/projects/$project/design-systems"
        val canonical = "/api/design-systems" + path.removePrefix(prefix)
        val shared = call.request.httpMethod == HttpMethod.Get && canonical in publicReads.sharedGetPaths
        val operation = publicReads.find(call.request.httpMethod.value, canonical)
        if (!shared && operation == null) return null
        val authorization = call.request.headers[HttpHeaders.Authorization]
        if (authorization == null) return shared || candidate(call, project, requireNotNull(operation), null)
        return when (val decision = authorizer.project(authorization, project)) {
            is GatewayAuthDecision.Allowed -> {
                call.attributes.put(
                    verifiedContextKey,
                    verifiedHeaders(call.request.headers, decision.trustedHeaders.asMap()),
                )
                true
            }
            is GatewayAuthDecision.Forbidden -> publicIdentity(call, authorization, project, operation, shared)
            else -> rejectIdentity(call, decision)
        }
    }

    private suspend fun publicIdentity(
        call: ApplicationCall,
        authorization: String,
        project: String,
        operation: DsReadOperation?,
        shared: Boolean,
    ): Boolean {
        // Отсутствие членства допускает публичное чтение только после независимой проверки личности.
        val user = authorizer.user(authorization)
        if (user !is GatewayAuthDecision.Allowed) return rejectIdentity(call, user)
        val actorType = user.trustedHeaders.actorType
        val scopes = user.trustedHeaders.projectScopes.orEmpty().split(',')
        val actorAllowed = actorType in setOf("user", "personal_access_token")
        val scopeAllowed = shared || actorType != "personal_access_token" || operation?.permission in scopes
        if (!actorAllowed || !scopeAllowed) {
            reject(call, HttpStatusCode.Forbidden)
            return false
        }
        return shared || candidate(call, project, requireNotNull(operation), user.trustedHeaders.userId)
    }

    private fun candidate(
        call: ApplicationCall,
        project: String,
        operation: DsReadOperation,
        userId: String?,
    ): Boolean {
        call.response.header(HttpHeaders.CacheControl, "no-store")
        val fields = mutableMapOf(
            "X-DS-Public-Read" to "true",
            "X-Project-Id" to project,
            "X-DS-Public-Kind" to operation.kind.name,
            "X-DS-Public-Path" to operation.path,
            "X-DS-Public-Method" to operation.method,
            "X-DS-Public-Permission" to operation.permission,
        )
        userId?.let { fields["X-User-Id"] = it }
        call.attributes.put(verifiedContextKey, verifiedHeaders(call.request.headers, fields))
        return true
    }

    private suspend fun rejectIdentity(call: ApplicationCall, decision: GatewayAuthDecision): Boolean {
        val status = when (decision) {
            is GatewayAuthDecision.Unauthorized -> HttpStatusCode.Unauthorized
            is GatewayAuthDecision.Unavailable -> HttpStatusCode.ServiceUnavailable
            else -> HttpStatusCode.Forbidden
        }
        reject(call, status)
        return false
    }

    private fun preliminaryStatus(call: ApplicationCall, path: String): HttpStatusCode? = when {
        invalidPath(path) -> HttpStatusCode.BadRequest
        java.net.URI(path).path.startsWith("/internal/") -> HttpStatusCode.Forbidden
        !publicGatewayPath(java.net.URI(path).path) -> HttpStatusCode.NotFound
        call.request.httpMethod == HttpMethod.Options -> HttpStatusCode.NoContent
        else -> null
    }

    private fun invalidPath(path: String): Boolean =
        Regex("(?i)%(?:2f|5c|2e|00|25)").containsMatchIn(path) ||
            listOf("\\", "/../", "/./", "//").any(path::contains) ||
            runCatching { java.net.URI(path) }.isFailure

    private suspend fun acceptBody(
        call: ApplicationCall,
        path: String,
        policy: RoutePolicy,
    ): Boolean {
        val maxBytes = when {
            path == "/api/privacy/analytics/consent" -> 4096L
            policy.documentation -> configuration.documentationMaxBytes
            path in pluginPublishPaths -> 64L * 1024 * 1024
            path == ICON_CATALOG_UPLOAD_PATH -> 32L * 1024 * 1024
            policy.ds || path == "/api/admin/component-config/import-api-meta" -> 16L * 1024 * 1024
            else -> 2L * 1024 * 1024
        }
        call.attributes.put(requestLimitKey, maxBytes)
        val length = call.request.headers[HttpHeaders.ContentLength]?.toLongOrNull()
        val accepted = length == null || length in 0..maxBytes
        if (!accepted) reject(call, HttpStatusCode.PayloadTooLarge)
        return accepted
    }

    private data class RoutePolicy(
        val projectId: String?,
        val userRoute: Boolean,
        val ds: Boolean,
        val documentation: Boolean,
    )

    private fun routePolicy(path: String): RoutePolicy {
        val project = Regex("^/api/projects/([^/]+)(?:/.*)?$").matchEntire(path)
        val userRoute = path.startsWith("/api/settings/personal-access-tokens") ||
            path in pluginPublishPaths || path in setOf(
                "/api/projects", "/api/projects/member-candidates",
                "/api/admin/component-config/import-api-meta", ICON_CATALOG_UPLOAD_PATH,
            )
        val ds = project != null && path.startsWith("/api/projects/${project.groupValues[1]}/design-systems")
        val documentation = project != null && path.startsWith("/api/projects/${project.groupValues[1]}/documentation")
        return RoutePolicy(project?.groupValues?.get(1), userRoute, ds, documentation)
    }

    private suspend fun authorize(
        call: ApplicationCall,
        path: String,
        userRoute: Boolean,
        project: String?,
    ): Boolean {
        if (!userRoute && project == null) return true
        return run {
            val decision = if (userRoute) {
                authorizer.user(call.request.headers[HttpHeaders.Authorization])
            } else {
                authorizer.project(call.request.headers[HttpHeaders.Authorization], requireNotNull(project))
            }
            when (decision) {
                is GatewayAuthDecision.Allowed -> {
                    if (!allowsUserRoute(decision, path, userRoute, call.request.httpMethod)) {
                        reject(call, HttpStatusCode.Forbidden)
                        return@run false
                    }
                    val context = decision.trustedHeaders.asMap().toMutableMap()
                    if (path.startsWith("/api/admin/")) context["X-Project-Id"] = "global"
                    call.attributes.put(verifiedContextKey, verifiedHeaders(call.request.headers, context))
                    true
                }
                is GatewayAuthDecision.Unauthorized -> {
                    reject(call, HttpStatusCode.Unauthorized)
                    false
                }
                is GatewayAuthDecision.Unavailable -> {
                    reject(call, HttpStatusCode.ServiceUnavailable)
                    false
                }
                is GatewayAuthDecision.Forbidden -> {
                    reject(call, HttpStatusCode.Forbidden)
                    false
                }
            }
        }
    }

    private fun allowsUserRoute(
        decision: GatewayAuthDecision.Allowed,
        path: String,
        userRoute: Boolean,
        method: HttpMethod,
    ): Boolean {
        if (decision.trustedHeaders.actorType != "personal_access_token" || !userRoute) return true
        return path == "/api/projects" && method == HttpMethod.Get &&
            "projects:read" in decision.trustedHeaders.projectScopes.orEmpty().split(',')
    }

    private fun cors(call: ApplicationCall) {
        val origin = call.request.headers[HttpHeaders.Origin]
        val webAllowed = origin != null && webOriginAllowed(origin)
        val pluginAllowed = origin != null && !webAllowed && pluginOriginAllowed(call, origin)
        if (webAllowed || pluginAllowed) {
            call.response.header(HttpHeaders.AccessControlAllowOrigin, requireNotNull(origin))
            val path = call.request.path()
            val publicPath = publicGatewayPath(path) && !path.startsWith("/internal/") && !invalidPath(path)
            if (call.request.httpMethod == HttpMethod.Options && publicPath) {
                call.response.header(HttpHeaders.AccessControlMaxAge, "600")
            }
        }
        call.response.header(HttpHeaders.Vary, "Origin")
        call.response.header(
            HttpHeaders.AccessControlAllowMethods,
            if (pluginAllowed) {
                pluginCors.allowedMethods(call.request.path())
            } else {
                "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            },
        )
        call.response.header(
            HttpHeaders.AccessControlAllowHeaders,
            "Authorization, Content-Type, Accept, X-Requested-With, If-None-Match, " +
                "X-Consent-Key, X-DS-Base-Revision, X-DS-Core-Selection-Revision, X-DS-Client-Id, Idempotency-Key",
        )
        call.response.header(
            HttpHeaders.AccessControlExposeHeaders,
            "X-DS-Journal-Total, X-DS-Mutation-Metadata, X-DS-Mutation-Metadata-Truncated, " +
                "X-DS-Read-Context, X-DS-Page-Limit, X-DS-Next-Cursor, ETag",
        )
        call.response.header("X-Request-Id", UUID.randomUUID().toString())
    }

    private fun webOriginAllowed(origin: String): Boolean = if (configuration.webOrigin != null) {
        origin == configuration.webOrigin
    } else {
        Regex("http://(localhost|127\\.0\\.0\\.1):[0-9]+").matches(origin)
    }

    private fun pluginOriginAllowed(call: ApplicationCall, origin: String): Boolean {
        val preflight = call.request.httpMethod == HttpMethod.Options
        val method = if (preflight) {
            call.request.headers[HttpHeaders.AccessControlRequestMethod]
        } else {
            call.request.httpMethod.value
        }
        return pluginCors.allows(origin, method, call.request.path())
    }

    private suspend fun reject(call: ApplicationCall, status: HttpStatusCode) {
        call.respondText("", status = status)
    }
}
