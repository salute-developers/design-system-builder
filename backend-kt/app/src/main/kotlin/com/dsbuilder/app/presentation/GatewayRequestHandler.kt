package com.dsbuilder.app.presentation

import com.dsbuilder.app.GatewayConfiguration
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
) {
    private val limits = GatewayLimits()
    private val proxyTrust = ProxyTrust(configuration.trustedProxyCidrs)
    private val connectionKeyAttribute = io.ktor.util.AttributeKey<String>("backend.active.ds.key")

    suspend fun validate(call: ApplicationCall): Boolean {
        cors(call)
        val rawPath = call.request.path()
        val rejected = preliminaryStatus(call, rawPath)
        if (rejected != null) {
            reject(call, rejected)
            return false
        }
        val path = java.net.URI(rawPath).path
        val policy = routePolicy(path)
        // Forwarded headers never select a limiter identity without a trusted proxy configuration.
        val peer = proxyTrust.clientAddress(call.request.local.remoteHost, call.request.headers["X-Forwarded-For"])
        if (policy.rateLimited && !limits.allow(peer)) {
            reject(call, HttpStatusCode.ServiceUnavailable)
            return false
        }
        return acceptBody(call, path, policy) &&
            authorize(call, path, policy.userRoute, policy.projectId) && acquire(call, path, peer, policy.ds)
    }

    private fun preliminaryStatus(call: ApplicationCall, path: String): HttpStatusCode? = when {
        call.request.httpMethod == HttpMethod.Options -> HttpStatusCode.NoContent
        invalidPath(path) -> HttpStatusCode.BadRequest
        java.net.URI(path).path.startsWith("/internal/") -> HttpStatusCode.Forbidden
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
            policy.documentation -> configuration.documentationMaxBytes
            path == "/api/admin/compose-preview/plugin-builds" -> 64L * 1024 * 1024
            policy.ds || path == "/api/admin/component-config/import-api-meta" -> 16L * 1024 * 1024
            else -> 2L * 1024 * 1024
        }
        call.attributes.put(requestLimitKey, maxBytes)
        val length = call.request.headers[HttpHeaders.ContentLength]?.toLongOrNull()
        val accepted = length == null || length in 0..maxBytes
        if (!accepted) reject(call, HttpStatusCode.PayloadTooLarge)
        return accepted
    }

    private suspend fun acquire(
        call: ApplicationCall,
        path: String,
        peer: String,
        ds: Boolean,
    ): Boolean {
        val key = "$peer|$path"
        val accepted = !ds || limits.acquire(key)
        if (!accepted) reject(call, HttpStatusCode.ServiceUnavailable)
        if (accepted && ds) call.attributes.put(connectionKeyAttribute, key)
        return accepted
    }

    private data class RoutePolicy(
        val projectId: String?,
        val userRoute: Boolean,
        val ds: Boolean,
        val documentation: Boolean,
        val rateLimited: Boolean,
    )

    private fun routePolicy(path: String): RoutePolicy {
        val project = Regex("^/api/projects/([^/]+)(?:/.*)?$").matchEntire(path)
        val userRoute = path in setOf(
            "/api/projects", "/api/projects/member-candidates",
            "/api/admin/component-config/import-api-meta", "/api/admin/compose-preview/plugin-builds",
        )
        val ds = project != null && path.startsWith("/api/projects/${project.groupValues[1]}/ds")
        val documentation = project != null && path.startsWith("/api/projects/${project.groupValues[1]}/documentation")
        val rateLimited = userRoute || project != null && (!documentation || configuration.documentationRateLimited) ||
            listOf("/auth/", "/realms/", "/resources/", "/admin/").any(path::startsWith)
        return RoutePolicy(project?.groupValues?.get(1), userRoute, ds, documentation, rateLimited)
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
                    val context = decision.trustedHeaders.asMap().toMutableMap()
                    if (path.startsWith("/api/admin/")) context["X-Project-Id"] = "global"
                    call.attributes.put(verifiedContextKey, verifiedHeaders(call.request.headers, context))
                    true
                }
                is GatewayAuthDecision.Unauthorized -> {
                    reject(call, HttpStatusCode.Unauthorized)
                    false
                }
                is GatewayAuthDecision.Forbidden -> {
                    reject(call, HttpStatusCode.Forbidden)
                    false
                }
            }
        }
    }

    fun release(call: ApplicationCall) {
        call.attributes.getOrNull(connectionKeyAttribute)?.let(limits::release)
    }

    private fun cors(call: ApplicationCall) {
        val origin = call.request.headers[HttpHeaders.Origin]
        val allowed = origin != null && if (configuration.webOrigin != null) {
            origin == configuration.webOrigin
        } else {
            Regex("http://(localhost|127\\.0\\.0\\.1):[0-9]+").matches(origin)
        }
        if (allowed) call.response.header(HttpHeaders.AccessControlAllowOrigin, origin!!)
        call.response.header(HttpHeaders.Vary, "Origin")
        call.response.header(HttpHeaders.AccessControlAllowMethods, "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        call.response.header(
            HttpHeaders.AccessControlAllowHeaders,
            "Authorization, Content-Type, Accept, X-Requested-With, " +
                "X-DS-Base-Revision, X-DS-Client-Id, Idempotency-Key",
        )
        call.response.header(
            HttpHeaders.AccessControlExposeHeaders,
            "X-DS-Mutation-Metadata, X-DS-Mutation-Metadata-Truncated",
        )
        call.response.header("X-Request-Id", UUID.randomUUID().toString())
    }

    private suspend fun reject(call: ApplicationCall, status: HttpStatusCode) {
        call.respondText("", status = status)
    }
}
