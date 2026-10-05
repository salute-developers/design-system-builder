package com.dsbuilder.ds.tokens.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.tokens.application.CreatePaletteEntry
import com.dsbuilder.ds.tokens.application.CreatePaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.DeletePaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.GetPaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.ListPaletteByTypeUseCase
import com.dsbuilder.ds.tokens.application.ListPaletteUseCase
import com.dsbuilder.ds.tokens.application.UpdatePaletteEntryUseCase
import com.dsbuilder.ds.tokens.domain.PaletteType
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import java.util.UUID

/** Registers globally readable, system-admin writable palette endpoints. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.paletteRoutes(
    evaluator: PolicyEvaluator,
    list: ListPaletteUseCase,
    get: GetPaletteEntryUseCase,
    listByType: ListPaletteByTypeUseCase,
    create: CreatePaletteEntryUseCase,
    update: UpdatePaletteEntryUseCase,
    delete: DeletePaletteEntryUseCase,
) {
    route("/api/ds/palette") {
        get {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            when (val result = list.execute(context)) {
                is DsResult.Success -> call.respond(result.value.map(PaletteEntryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/by-type/{type}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val type = PaletteType.fromWire(call.parameters["type"])
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_type"))
            when (val result = listByType.execute(context, type)) {
                is DsResult.Success -> call.respond(result.value.map(PaletteEntryResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@get call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.paletteUuid()
                ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = get.execute(context, id)) {
                is DsResult.Success -> call.respond(PaletteEntryResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        @Suppress("ComplexCondition")
        post {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@post call.respondFailure(DsFailure.Forbidden)
            val request = call.receive<CreatePaletteEntryRequest>()
            val type = PaletteType.fromWire(request.type)
            if (
                type == null ||
                request.shade.trim().isEmpty() ||
                request.shade.trim().length > 100 ||
                request.saturation !in 0..100 ||
                request.value.trim().isEmpty()
            ) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = CreatePaletteEntry(
                type,
                request.shade.trim(),
                request.saturation,
                request.value.trim(),
            )
            when (val result = create.execute(context, command)) {
                is DsResult.Success -> call.respond(HttpStatusCode.Created, PaletteEntryResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        patch("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@patch call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.paletteUuid()
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            val request = call.receive<UpdatePaletteEntryRequest>()
            val value = request.value?.trim()?.takeIf(String::isNotEmpty)
                ?: return@patch call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            when (val result = update.execute(context, id, value)) {
                is DsResult.Success -> call.respond(PaletteEntryResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}") {
            val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
                ?: return@delete call.respondFailure(DsFailure.Forbidden)
            val id = call.parameters["id"]?.paletteUuid()
                ?: return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
            when (val result = delete.execute(context, id)) {
                is DsResult.Success -> call.respond(OkResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

private fun String.paletteUuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()
