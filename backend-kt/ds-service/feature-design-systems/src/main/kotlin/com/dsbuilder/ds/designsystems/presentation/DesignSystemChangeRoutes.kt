package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import com.dsbuilder.ds.designsystems.application.ListDraftChangesUseCase
import com.dsbuilder.ds.designsystems.application.RevertDraftChangeUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DraftChange
import io.ktor.server.request.receiveText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/** Вычисляемый журнал конкретной дизайн-системы и откат его черновых записей. */
fun Route.designSystemChangeRoutes(
    evaluator: PolicyEvaluator,
    list: ListDraftChangesUseCase,
    revert: RevertDraftChangeUseCase,
    json: Json,
) {
    listChangeRoute(evaluator, list)
    revertChangeRoute(evaluator, revert, json)
}

private fun Route.listChangeRoute(evaluator: PolicyEvaluator, list: ListDraftChangesUseCase) {
    get("/api/ds/design-systems/{id}/changes") {
        val context = TrustedDsRequestContextMapper.map(
            call.request.headers,
            evaluator,
            call.request.queryParameters["versionId"],
        )
            ?: return@get call.respondFailure(DsFailure.Forbidden)
        val designSystemId = call.parameters["id"]?.uuid()
            ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        val rawVersionId = call.request.queryParameters["versionId"]
        val versionId = rawVersionId?.uuid()
            ?: rawVersionId?.let { return@get call.respondFailure(DsFailure.InvalidRequest("invalid_version_id")) }
        when (
            val result = list.execute(
                context,
                DesignSystemId(designSystemId),
                versionId?.let(::DesignSystemVersionId),
            )
        ) {
            is DsResult.Success -> call.respondSuccess(result, result.value.map(DraftChangeResponse::from))
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

private fun Route.revertChangeRoute(evaluator: PolicyEvaluator, revert: RevertDraftChangeUseCase, json: Json) {
    val revertJson = Json(json) { ignoreUnknownKeys = false }
    post("/api/ds/design-systems/{id}/changes/{changeId}/revert") {
        val context = TrustedDsRequestContextMapper.map(
            call.request.headers,
            evaluator,
            call.request.queryParameters["versionId"],
        )
            ?: return@post call.respondFailure(DsFailure.Forbidden)
        val designSystemId = call.parameters["id"]?.uuid()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        val changeId = call.parameters["changeId"]?.uuid()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_change_id"))
        val revision = call.request.headers["X-DS-Base-Revision"]?.toLongOrNull()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_base_revision"))
        val idempotencyKey = call.request.headers["Idempotency-Key"]
        if (idempotencyKey.isNullOrBlank()) {
            return@post call.respondFailure(DsFailure.InvalidRequest("idempotency_key_required"))
        }
        val request = when (val parsed = parseRevertRequest(call.receiveText(), revertJson)) {
            is DsResult.Success -> parsed.value
            is DsResult.Failure -> return@post call.respondFailure(parsed.error)
        }
        when (
            val result = revert.execute(
                context.withIdempotentResponse { _: Unit -> json.encodeToString(OkResponse()) },
                DesignSystemId(designSystemId),
                changeId,
                revision,
                idempotencyKey,
                request.paths,
            )
        ) {
            is DsResult.Success -> call.respondSuccess(result, OkResponse())
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

private fun parseRevertRequest(body: String, json: Json): DsResult<RevertDraftChangeRequest> {
    if (body.length > 16_384) return DsResult.Failure(DsFailure.InvalidRequest("invalid_revert_paths"))
    return try {
        DsResult.Success(if (body.isBlank()) RevertDraftChangeRequest() else json.decodeFromString(body))
    } catch (_: SerializationException) {
        DsResult.Failure(DsFailure.InvalidRequest("invalid_revert_request"))
    }
}

private fun String.uuid(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()

/** Внешнее представление вычисленного изменения. */
@Serializable
data class DraftChangeResponse(
    /** Устойчивый идентификатор изменения. */
    val changeId: String,
    /** Идентификатор сравниваемой версии. */
    val versionId: String,
    /** Тип предметной сущности. */
    val entityType: String,
    /** Идентификатор предметной сущности. */
    val entityId: String,
    /** Вид изменения. */
    val operation: String,
    /** Изменённые предметные пути. */
    val changedPaths: Set<String>,
    /** Предыдущее отображаемое значение. */
    val previousValue: JsonObject?,
    /** Новое отображаемое значение. */
    val currentValue: JsonObject?,
    /** Автор последнего изменения. */
    val actorId: String?,
    /** Время последнего изменения. */
    val changedAt: String,
    /** Текущая техническая редакция. */
    val editRevision: Long,
    /** Сервер поддерживает отдельную отмену параметров этой записи. */
    val parameterRevertSupported: Boolean,
) {
    companion object {
        /** Создаёт внешний ответ из вычисленного отличия. */
        fun from(change: DraftChange) = DraftChangeResponse(
            change.changeId.toString(),
            change.versionId.value.toString(),
            change.entityType,
            change.entityId.toString(),
            change.operation.wireValue,
            change.changedPaths,
            change.previousValue,
            change.currentValue,
            change.actorId,
            change.changedAt.toString(),
            change.editRevision,
            change.entityType == "token-value" && change.operation.wireValue == "updated",
        )
    }
}
