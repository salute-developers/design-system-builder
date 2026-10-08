package com.dsbuilder.ds.themes.presentation.palette

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.themes.application.palette.TenantPaletteMutation
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRampTarget
import com.dsbuilder.ds.themes.application.palette.TenantPaletteUseCases
import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.palette.PaletteAnchor
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.RemoveRampStrategy
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import kotlinx.serialization.json.JsonNull
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

/** Регистрирует маршруты палитры темы `/api/ds/tenants/{tenantId}/palette`. */
fun Route.tenantPaletteRoutes(evaluator: PolicyEvaluator, useCases: TenantPaletteUseCases) {
    route("/api/ds/tenants/{tenantId}/palette") {
        paletteReadRoutes(evaluator, useCases)
        paletteGroupRoutes(evaluator, useCases)
        route("/groups/{groupId}/ramps") {
            paletteRampRoutes(evaluator, useCases)
            paletteRampEditRoutes(evaluator, useCases)
        }
    }
}

private fun Route.paletteReadRoutes(evaluator: PolicyEvaluator, useCases: TenantPaletteUseCases) {
    get {
        val (context, tenantId) = call.paletteTarget(evaluator) ?: return@get
        when (val result = useCases.get.execute(context, tenantId)) {
            is DsResult.Success -> call.respond(result.value.toResponse())
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
    get("/links") {
        val (context, tenantId) = call.paletteTarget(evaluator) ?: return@get
        val query = call.request.queryParameters
        val slot = rampRef(query["type"], query["shade"])
        val step = query["step"]?.let { it.toIntOrNull() ?: return@get call.respondFailure(INVALID_QUERY) }
        if (slot == null) return@get call.respondFailure(INVALID_QUERY)
        when (val result = useCases.links.execute(context, tenantId, slot, query["groupId"], step)) {
            is DsResult.Success -> call.respond(result.value.map { it.toDto() })
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

private fun Route.paletteGroupRoutes(evaluator: PolicyEvaluator, useCases: TenantPaletteUseCases) {
    post("/groups") {
        val (context, tenantId) = call.paletteTarget(evaluator) ?: return@post
        val body = call.body<PaletteGroupLabelRequest>() ?: return@post
        val result = useCases.createGroup.execute(context, tenantId, body.label, body.editRevision)
        call.respondMutation(result, HttpStatusCode.Created) { it.toDto() }
    }
    patch("/groups/{groupId}") {
        val (context, tenantId) = call.paletteTarget(evaluator) ?: return@patch
        val body = call.body<PaletteGroupLabelRequest>() ?: return@patch
        val groupId = call.parameters["groupId"].orEmpty()
        val result = useCases.renameGroup.execute(context, tenantId, groupId, body.label, body.editRevision)
        call.respondMutation(result) { it.toDto() }
    }
    delete("/groups/{groupId}") {
        val (context, tenantId) = call.paletteTarget(evaluator) ?: return@delete
        val body = call.body<PaletteRevisionRequest>() ?: return@delete
        val groupId = call.parameters["groupId"].orEmpty()
        val result = useCases.deleteGroup.execute(context, tenantId, groupId, body.editRevision)
        call.respondMutation(result) { JsonNull }
    }
    put("/token-groups/{tokenId}") {
        val (context, tenantId) = call.paletteTarget(evaluator) ?: return@put
        val body = call.body<PaletteTokenGroupRequest>() ?: return@put
        val tokenId = call.parameters["tokenId"].orEmpty()
        val result = useCases.assignTokenGroup.execute(context, tenantId, tokenId, body.groupId, body.editRevision)
        call.respondMutation(result) { it.toDto() }
    }
}

private fun Route.paletteRampRoutes(evaluator: PolicyEvaluator, useCases: TenantPaletteUseCases) {
    post {
        val (context, tenantId) = call.paletteTarget(evaluator) ?: return@post
        val body = call.body<PaletteRampRequest>() ?: return@post
        val slot = rampRef(body.type, body.shade) ?: return@post call.respondFailure(INVALID_BODY)
        val target = TenantPaletteRampTarget(call.parameters["groupId"].orEmpty(), slot)
        val result = useCases.addRamp.execute(context, tenantId, target, body.editRevision)
        call.respondMutation(result, HttpStatusCode.Created) { it.toDto() }
    }
    put("/{type}/{shade}/source") {
        val (context, tenantId) = call.paletteTarget(evaluator) ?: return@put
        val target = call.rampTarget() ?: return@put
        val body = call.body<PaletteRampRequest>() ?: return@put
        val source = rampRef(body.type, body.shade) ?: return@put call.respondFailure(INVALID_BODY)
        val result = useCases.replaceSource.execute(context, tenantId, target, source, body.editRevision)
        call.respondMutation(result) { it.toDto() }
    }
    post("/{type}/{shade}/rebuild") {
        val (context, tenantId) = call.paletteTarget(evaluator) ?: return@post
        val target = call.rampTarget() ?: return@post
        val body = call.body<PaletteRebuildRequest>() ?: return@post
        call.respondRebuild(useCases, context, tenantId, target, body)
    }
}

private fun Route.paletteRampEditRoutes(evaluator: PolicyEvaluator, useCases: TenantPaletteUseCases) {
    patch("/{type}/{shade}/steps/{step}") {
        val (context, tenantId) = call.paletteTarget(evaluator) ?: return@patch
        val target = call.rampTarget() ?: return@patch
        val step = call.parameters["step"]?.toIntOrNull() ?: return@patch call.respondFailure(INVALID_RAMP)
        val body = call.body<PaletteStepRequest>() ?: return@patch
        val result = useCases.updateStep.execute(context, tenantId, target, step, body.value, body.editRevision)
        call.respondMutation(result) { it.toDto() }
    }
    delete("/{type}/{shade}") {
        val (context, tenantId) = call.paletteTarget(evaluator) ?: return@delete
        val target = call.rampTarget() ?: return@delete
        val body = call.body<PaletteRemoveRampRequest>() ?: return@delete
        call.respondRemoveRamp(useCases, context, tenantId, target, body)
    }
}

private suspend fun ApplicationCall.respondRebuild(
    useCases: TenantPaletteUseCases,
    context: DsRequestContext,
    tenantId: UUID,
    target: TenantPaletteRampTarget,
    body: PaletteRebuildRequest,
) {
    val anchor = PaletteAnchor(body.anchorStep, body.value)
    if (!body.preview) {
        return respondMutation(useCases.rebuild.execute(context, tenantId, target, anchor, body.editRevision)) {
            it.toDto()
        }
    }
    when (val result = useCases.previewRebuild.execute(context, tenantId, target, anchor, body.editRevision)) {
        is DsResult.Success -> respond(RebuildPreviewResponse(result.value.toStepValues()))
        is DsResult.Failure -> respondFailure(result.error)
    }
}

private suspend fun ApplicationCall.respondRemoveRamp(
    useCases: TenantPaletteUseCases,
    context: DsRequestContext,
    tenantId: UUID,
    target: TenantPaletteRampTarget,
    body: PaletteRemoveRampRequest,
) {
    val strategy = body.strategy?.let { RemoveRampStrategy.fromWire(it) ?: return respondFailure(INVALID_BODY) }
    val replacement = body.replacement?.let { rampRef(it.type, it.shade) ?: return respondFailure(INVALID_BODY) }
    val result = useCases.removeRamp.execute(context, tenantId, target, strategy, replacement, body.editRevision)
    respondMutation(result) { RemovedRampDto(it.reassigned) }
}

/** Контекст запроса и тема; `null`, если ответ с ошибкой уже отправлен. */
private suspend fun ApplicationCall.paletteTarget(evaluator: PolicyEvaluator): Pair<DsRequestContext, UUID>? {
    val context = TrustedDsRequestContextMapper.map(request.headers, evaluator)
        ?: return null.also { respondFailure(DsFailure.Forbidden) }
    val tenantId = parameters["tenantId"]?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        ?: return null.also { respondFailure(INVALID_TENANT) }
    return context to tenantId
}

/** Растяжка группы из пути; `null`, если ответ с ошибкой уже отправлен. */
private suspend fun ApplicationCall.rampTarget(): TenantPaletteRampTarget? {
    val slot = rampRef(parameters["type"], parameters["shade"]) ?: return null.also { respondFailure(INVALID_RAMP) }
    return TenantPaletteRampTarget(parameters["groupId"].orEmpty(), slot)
}

/** Тело запроса; `null`, если ответ с ошибкой уже отправлен. */
private suspend inline fun <reified T : Any> ApplicationCall.body(): T? =
    runCatching { receive<T>() }
        .onFailure { if (it is CancellationException) throw it }
        .getOrNull() ?: null.also { respondFailure(INVALID_BODY) }

private suspend inline fun <T, reified R : Any> ApplicationCall.respondMutation(
    result: DsResult<TenantPaletteMutation<T>>,
    status: HttpStatusCode = HttpStatusCode.OK,
    dto: (T) -> R,
) = when (result) {
    is DsResult.Success -> respond(status, PaletteMutationResponse(result.value.editRevision, dto(result.value.value)))
    is DsResult.Failure -> respondFailure(result.error)
}

private fun rampRef(type: String?, shade: String?): PaletteRampRef? {
    val paletteType = ThemePaletteType.fromWire(type) ?: return null
    return shade?.takeIf { it.isNotBlank() }?.let { PaletteRampRef(paletteType, it) }
}

// Строковый `message`: клиент показывает его пользователю, `error` у 400 — объект проверки полей.
private val INVALID_TENANT = DsFailure.InvalidRequest("invalid_id", message = "Некорректный идентификатор темы")

// Путь растяжки и query — не UUID: код без подсказки про UUID в `fieldErrors`.
private val INVALID_RAMP = DsFailure.InvalidRequest(
    "invalid_body",
    message = "Некорректная растяжка или ступень в пути",
)
private val INVALID_BODY = DsFailure.InvalidRequest("invalid_body", message = "Некорректное тело запроса")
private val INVALID_QUERY = DsFailure.InvalidRequest("invalid_body", message = "Нужны type и shade, step — число")
