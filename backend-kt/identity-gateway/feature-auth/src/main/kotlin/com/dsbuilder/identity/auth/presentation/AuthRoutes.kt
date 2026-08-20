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
    val authorizeProjectRequest by inject<AuthorizeProjectRequestUseCase>()
    val authorizeUserRequest by inject<AuthorizeUserRequestUseCase>()

    routing {
        get("/health") {
            call.respond(HttpStatusCode.OK)
        }

        route("/internal/auth") {
            get("/user") {
                when (val decision = authorizeUserRequest.execute(call.request.headers[HttpHeaders.Authorization])) {
                    is GatewayAuthDecision.Allowed -> {
                        decision.trustedHeaders.asMap().forEach { (name, value) ->
                            call.response.header(name, value)
                        }
                        call.respond(HttpStatusCode.NoContent)
                    }
                    is GatewayAuthDecision.Unauthorized -> {
                        call.respond(HttpStatusCode.Unauthorized, AuthErrorResponse(decision.reason))
                    }
                    is GatewayAuthDecision.Forbidden -> {
                        call.respond(HttpStatusCode.Forbidden, AuthErrorResponse(decision.reason))
                    }
                }
            }

            get("/projects/{projectId}") {
                val projectId = call.parameters["projectId"]
                if (projectId.isNullOrBlank()) {
                    call.respond(HttpStatusCode.BadRequest, AuthErrorResponse("Missing project id"))
                    return@get
                }

                when (
                    val decision = authorizeProjectRequest.execute(
                        GatewayAuthInput(
                            authorizationHeader = call.request.headers[HttpHeaders.Authorization],
                            projectId = projectId,
                        ),
                    )
                ) {
                    is GatewayAuthDecision.Allowed -> {
                        decision.trustedHeaders.asMap().forEach { (name, value) ->
                            call.response.header(name, value)
                        }
                        call.respond(HttpStatusCode.NoContent)
                    }
                    is GatewayAuthDecision.Unauthorized -> {
                        call.respond(HttpStatusCode.Unauthorized, AuthErrorResponse(decision.reason))
                    }
                    is GatewayAuthDecision.Forbidden -> {
                        call.respond(HttpStatusCode.Forbidden, AuthErrorResponse(decision.reason))
                    }
                }
            }
        }
    }
}

@Serializable
internal data class AuthErrorResponse(
    val message: String,
)
