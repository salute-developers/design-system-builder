package com.dsbuilder.ds.core.presentation

import com.dsbuilder.ds.core.application.DsFailure
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.util.AttributeKey
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Maps typed application failures to the stable JSON error envelope. */
suspend fun ApplicationCall.respondFailure(failure: DsFailure) {
    attributes.put(DsFailureOutcome, failure.telemetryOutcome())
    val error = if (failure is DsFailure.InvalidRequest) {
        if (failure.code == "invalid_body") {
            legacyValidationError()?.invoke() ?: failure.validationError()
        } else {
            failure.validationError()
        }
    } else {
        null
    }
    respond(
        failure.status(),
        error?.let { ErrorResponse(it) } ?: failure.toErrorResponse(),
    )
}

/** Returns the application outcome recorded at the actual failure boundary. */
fun ApplicationCall.dsFailureOutcome(): String? = attributes.getOrNull(DsFailureOutcome)

/** Records a non-[DsFailure] outcome handled by the application boundary. */
fun ApplicationCall.markDsFailureOutcome(outcome: String) {
    attributes.put(DsFailureOutcome, outcome)
}

/** Installs the route-aware legacy validation adapter for this call. */
fun ApplicationCall.installLegacyValidationError(provider: suspend () -> kotlinx.serialization.json.JsonElement?) {
    attributes.put(LegacyValidationError, LegacyValidationProvider(provider))
}

private fun ApplicationCall.legacyValidationError() = attributes.getOrNull(LegacyValidationError)?.provider

private val DsFailureOutcome = AttributeKey<String>("DsFailureOutcome")
private val LegacyValidationError = AttributeKey<LegacyValidationProvider>("LegacyValidationError")

private class LegacyValidationProvider(
    val provider: suspend () -> kotlinx.serialization.json.JsonElement?,
)

private fun DsFailure.telemetryOutcome(): String = when (this) {
    DsFailure.Forbidden -> "rbac_denied"
    DsFailure.NotFound -> "ownership_or_missing"
    is DsFailure.InvalidRequest -> if (transactionFailure) "transaction_failure" else "invalid_request"
    is DsFailure.Conflict -> if (transactionFailure) "transaction_failure" else "constraint_conflict"
    is DsFailure.Unprocessable -> "unprocessable"
    is DsFailure.DependencyUnavailable -> "dependency_unavailable"
    DsFailure.TechnicalFailure -> "transaction_failure"
}

private fun DsFailure.InvalidRequest.validationError() = buildJsonObject {
    val parameter = code.removePrefix("invalid_").takeUnless { it == code || it == "body" }
        ?.split(
            '_',
        )?.let { words -> words.first() + words.drop(1).joinToString("") { it.replaceFirstChar(Char::uppercase) } }
    put(
        "formErrors",
        buildJsonArray {},
    )
    put(
        "fieldErrors",
        buildJsonObject {
            parameter?.let { field -> put(field, buildJsonArray { add(JsonPrimitive("Must be a valid UUID")) }) }
        },
    )
}

private fun DsFailure.status() = when (this) {
    is DsFailure.InvalidRequest -> HttpStatusCode.BadRequest
    DsFailure.Forbidden -> HttpStatusCode.Forbidden
    DsFailure.NotFound -> HttpStatusCode.NotFound
    is DsFailure.Conflict -> HttpStatusCode.Conflict
    is DsFailure.Unprocessable -> HttpStatusCode.UnprocessableEntity
    is DsFailure.DependencyUnavailable -> HttpStatusCode.ServiceUnavailable
    DsFailure.TechnicalFailure -> HttpStatusCode.InternalServerError
}

private fun DsFailure.publicMessage() = when (this) {
    is DsFailure.InvalidRequest -> code
    DsFailure.Forbidden -> "Forbidden"
    DsFailure.NotFound -> "Not found"
    is DsFailure.Conflict -> code
    is DsFailure.Unprocessable -> code
    is DsFailure.DependencyUnavailable -> "Dependency unavailable"
    DsFailure.TechnicalFailure -> "Internal server error"
}

private fun DsFailure.details() = (this as? DsFailure.Unprocessable)?.message

private fun DsFailure.toErrorResponse() = when (this) {
    is DsFailure.Conflict -> ErrorResponse(publicMessage(), code = code, editRevision = editRevision)
    else -> ErrorResponse(publicMessage(), details())
}
