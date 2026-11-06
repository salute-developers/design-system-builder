package com.dsbuilder.settings.presentation

import com.dsbuilder.settings.application.IdentityUnavailable
import com.dsbuilder.settings.application.InvalidTokenRequest
import com.dsbuilder.settings.application.TokenNotFound
import com.dsbuilder.settings.application.TokenUseCases
import com.dsbuilder.settings.application.tokenScopeCatalog
import com.dsbuilder.settings.domain.PersonalAccessToken
import io.ktor.http.Headers
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable

internal fun Route.userSettingsRoutes(
    tokens: TokenUseCases,
    scopes: Set<String>,
    headers: (ApplicationCall) -> Headers,
) {
    route("/api/settings/personal-access-tokens") {
        get {
            val owner = call.owner(headers, tokens) ?: return@get
            call.respond(tokens.list(owner).map { it.metadata() })
        }
        get("scopes") {
            call.owner(headers, tokens) ?: return@get
            val items = tokenScopeCatalog(scopes).map { ScopeResponse(it.id, it.title, it.description) }
            call.respond(ScopeCatalogResponse(items))
        }
        post {
            val owner = call.owner(headers, tokens) ?: return@post
            try {
                val request = call.receive<CreateTokenRequest>()
                val result = tokens.create(owner, request.name, request.scopes.toSet(), request.ttlSeconds)
                call.response.headers.append("Cache-Control", "no-store")
                call.respond(HttpStatusCode.Created, CreatedTokenResponse(result.token.metadata(), result.secret))
            } catch (error: InvalidTokenRequest) {
                call.respond(HttpStatusCode.BadRequest, ErrorResponse(error.message.orEmpty()))
            }
        }
        delete("{id}") {
            val owner = call.owner(headers, tokens) ?: return@delete
            try {
                call.respond(tokens.revoke(owner, call.parameters["id"].orEmpty()).metadata())
            } catch (_: TokenNotFound) {
                call.respond(HttpStatusCode.NotFound, ErrorResponse("Токен не найден"))
            }
        }
    }
}

private suspend fun ApplicationCall.owner(
    headers: (ApplicationCall) -> Headers,
    tokens: TokenUseCases,
): String? {
    val context = headers(this)
    val user = context["X-User-Id"]?.takeIf(String::isNotBlank)
    val failure = when {
        user == null -> HttpStatusCode.Unauthorized
        context["X-Actor-Type"] != "user" || context["X-Service-Account"] == "true" ||
            context["X-Compose-Preview-Publisher"] == "true" -> HttpStatusCode.Forbidden
        else -> try {
            if (tokens.canManage(user)) null else HttpStatusCode.Forbidden
        } catch (_: IdentityUnavailable) {
            HttpStatusCode.ServiceUnavailable
        }
    }
    if (failure != null) {
        respond(failure, ErrorResponse("Не удалось подтвердить пользовательскую сессию"))
        return null
    }
    response.headers.append("Cache-Control", "no-store")
    return user
}

@Serializable
private data class CreateTokenRequest(val name: String, val scopes: List<String>, val ttlSeconds: Long? = null)

@Serializable
private data class CreatedTokenResponse(val token: TokenResponse, val secret: String)

@Serializable
private data class ErrorResponse(val message: String)

@Serializable
private data class ScopeResponse(val id: String, val title: String, val description: String)

@Serializable
private data class ScopeCatalogResponse(val scopes: List<ScopeResponse>)

@Serializable
private data class TokenResponse(
    val id: String,
    val name: String,
    val scopes: List<String>,
    val createdAt: String,
    val expiresAt: String,
    val revokedAt: String?,
    val lastUsedAt: String?,
)

private fun PersonalAccessToken.metadata() = TokenResponse(
    id,
    name,
    scopes.sorted(),
    createdAt.toString(),
    expiresAt.toString(),
    revokedAt?.toString(),
    lastUsedAt?.toString(),
)
