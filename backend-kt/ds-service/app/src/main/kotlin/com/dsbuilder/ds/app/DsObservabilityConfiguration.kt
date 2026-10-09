package com.dsbuilder.ds.app

import com.dsbuilder.ds.core.presentation.dsFailureOutcome
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path
import io.ktor.util.AttributeKey
import kotlinx.serialization.json.Json

/** Configuration for the bounded ds-service telemetry plugin. */
class DsObservabilityConfiguration {
    /** Metrics registry that receives completed request observations. */
    lateinit var metrics: DsMetrics
}

/** Records request duration and status without retaining request or response bodies. */
val DsObservability = createApplicationPlugin("DsObservability", ::DsObservabilityConfiguration) {
    val registry = pluginConfig.metrics
    val operations = OpenApiDocumentResource(Json.Default).operations().map { operation ->
        val pattern = operation.path.split('/').joinToString("/") { segment ->
            if (segment.startsWith('{') && segment.endsWith('}')) "[^/]+" else Regex.escape(segment)
        }
        operation to Regex("^$pattern$")
    }
    onCall { call ->
        call.attributes.put(RequestStartedAt, System.nanoTime())
        operations.firstOrNull { (operation, pattern) ->
            operation.method.equals(call.request.httpMethod.value, ignoreCase = true) &&
                pattern.matches(call.request.path())
        }?.first?.let { operation ->
            call.attributes.put(RouteTemplate, operation.path)
            call.attributes.put(RoutePermission, operation.permission)
        }
    }
    onCallRespond { call, _ ->
        val startedAt = call.attributes.getOrNull(RequestStartedAt) ?: System.nanoTime()
        val durationMillis = (System.nanoTime() - startedAt) / NANOS_PER_MILLISECOND
        // Ktor assigns its implicit 200 after this hook when a handler did not set a status explicitly.
        val status = call.response.status() ?: HttpStatusCode.OK
        val outcome = call.dsFailureOutcome() ?: status.genericOutcome()
        call.attributes.put(RequestDurationMillis, durationMillis)
        call.attributes.put(RequestOutcome, outcome)
        registry.record(status, durationMillis, outcome)
    }
}

private val RequestStartedAt = AttributeKey<Long>("DsRequestStartedAt")
private val RequestDurationMillis = AttributeKey<Long>("DsRequestDurationMillis")
private val RequestOutcome = AttributeKey<String>("DsRequestOutcome")
private val RouteTemplate = AttributeKey<String>("DsRouteTemplate")
private val RoutePermission = AttributeKey<String>("DsRoutePermission")
private const val NANOS_PER_MILLISECOND = 1_000_000L

internal fun io.ktor.server.application.ApplicationCall.routeTemplate(): String =
    attributes.getOrNull(RouteTemplate) ?: "unmatched"

internal fun io.ktor.server.application.ApplicationCall.routePermission(): String =
    attributes.getOrNull(RoutePermission) ?: "none"

internal fun io.ktor.server.application.ApplicationCall.requestOutcome(): String =
    attributes.getOrNull(RequestOutcome) ?: dsFailureOutcome() ?: response.status().genericOutcome()

internal fun io.ktor.server.application.ApplicationCall.requestDurationMillis(): Long =
    attributes.getOrNull(RequestDurationMillis) ?: 0

private fun io.ktor.http.HttpStatusCode?.genericOutcome(): String = when (this?.value) {
    in 200..399 -> "success"
    400, 403, 404, 409, 422 -> "http_error"
    500, 503 -> "technical_failure"
    else -> "http_error"
}
