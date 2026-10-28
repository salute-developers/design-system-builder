package com.dsbuilder.app.presentation

import io.ktor.http.Headers
import io.ktor.server.application.ApplicationCall
import io.ktor.util.AttributeKey

internal val verifiedContextKey = AttributeKey<Headers>("backend.verified.context")

/** Контекст доступен только после проверки учётных данных публичным входом. */
fun ApplicationCall.verifiedRequestHeaders(): Headers = attributes.getOrNull(verifiedContextKey) ?: Headers.Empty

internal fun verifiedHeaders(incoming: Headers, context: Map<String, String>): Headers = Headers.build {
    incoming.forEach { name, values ->
        if (name.lowercase() !in trustedNames) appendAll(name, values)
    }
    context.forEach { (name, value) -> append(name, value) }
}

internal val trustedNames = setOf(
    "x-actor-type", "x-user-id", "x-project-id", "x-project-role", "x-project-key-id",
    "x-project-scopes", "x-system-admin", "x-compose-preview-publisher", "x-internal-api-key",
)
