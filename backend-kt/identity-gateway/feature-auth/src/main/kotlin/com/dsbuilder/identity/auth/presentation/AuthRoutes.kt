package com.dsbuilder.identity.auth.presentation

import com.dsbuilder.identity.auth.application.usecase.AuthorizeProjectRequestUseCase
import com.dsbuilder.identity.auth.application.usecase.AuthorizeUserRequestUseCase
import com.dsbuilder.identity.auth.application.usecase.GatewayAuthDecision
import com.dsbuilder.identity.auth.application.usecase.GatewayAuthInput
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlinx.serialization.Serializable
import org.koin.ktor.ext.inject

/** Регистрирует healthcheck и internal auth routes для Gateway. */
fun Application.authHelperRoutes() {
    val projects by inject<AuthorizeProjectRequestUseCase>()
    val users by inject<AuthorizeUserRequestUseCase>()
    routing {
        get("/health") { call.respond(HttpStatusCode.OK) }
        route("/internal/auth") {
            get("/user") {
                call.respondAuthDecision(users.execute(call.request.headers[HttpHeaders.Authorization]))
            }
            get("/projects/{projectId}") {
                val projectId = call.parameters["projectId"]
                if (projectId.isNullOrBlank()) {
                    call.respond(HttpStatusCode.BadRequest, AuthErrorResponse("Missing project id"))
                } else {
                    call.respondAuthDecision(
                        projects.execute(
                            GatewayAuthInput(call.request.headers[HttpHeaders.Authorization], projectId),
                        ),
                    )
                }
            }
        }
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.respondAuthDecision(decision: GatewayAuthDecision) {
    when (decision) {
        is GatewayAuthDecision.Allowed -> {
            decision.trustedHeaders.asMap().forEach { (name, value) -> response.header(name, value) }
            respond(HttpStatusCode.NoContent)
        }
        is GatewayAuthDecision.Unauthorized -> respond(HttpStatusCode.Unauthorized, AuthErrorResponse(decision.reason))
        is GatewayAuthDecision.Forbidden -> respond(HttpStatusCode.Forbidden, AuthErrorResponse(decision.reason))
        is GatewayAuthDecision.Unavailable -> respond(
            HttpStatusCode.ServiceUnavailable,
            AuthErrorResponse(decision.reason),
        )
    }
}

@Serializable
internal data class AuthErrorResponse(val message: String)
