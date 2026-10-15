package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.ComponentModelRepository
import com.dsbuilder.ds.components.application.CreatePropertyVariationUseCase
import com.dsbuilder.ds.components.application.GetPropertyVariationUseCase
import com.dsbuilder.ds.components.application.ListPropertyVariationsUseCase
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.json.Json

/** Registers property-to-variation link routes. */
@Suppress("CyclomaticComplexMethod", "LongMethod")
fun Route.propertyVariationRoutes(
    evaluator: PolicyEvaluator,
    list: ListPropertyVariationsUseCase,
    get: GetPropertyVariationUseCase,
    create: CreatePropertyVariationUseCase,
    json: Json,
) {
    route("/api/ds/property-variations") {
        get {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respondSuccess(result, result.value.map(PropertyVariationResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"].toUuidOrNull()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(result, PropertyVariationResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post {
            val context = TrustedDsRequestContextMapper.map(
                call.request.headers,
                evaluator,
                call.request.queryParameters["versionId"],
            )
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreatePropertyVariationRequest>()
            val propertyId = request.propertyId.toUuidOrNull()
            val variationId = request.variationId.toUuidOrNull()
            if (propertyId == null || variationId == null) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = ComponentModelRepository.PropertyVariationCreate(propertyId, variationId)
            when (
                val result = create.execute(
                    context.withIdempotentResponse { value: com.dsbuilder.ds.components.domain.PropertyVariation ->
                        json.encodeToString(PropertyVariationResponse.from(value))
                    },
                    command,
                    call.request.headers["Idempotency-Key"],
                )
            ) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    HttpStatusCode.Created,
                    PropertyVariationResponse.from(result.value),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}
