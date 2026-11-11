package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsPathDesignSystemId
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.modelReadContext
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import com.dsbuilder.ds.designsystems.application.DraftAddressTarget
import com.dsbuilder.ds.designsystems.application.DraftChangeRevertTarget
import com.dsbuilder.ds.designsystems.application.ListDraftChangesUseCase
import com.dsbuilder.ds.designsystems.application.RevertDraftChangeUseCase
import com.dsbuilder.ds.designsystems.application.RevertDraftChangesUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DraftChange
import io.ktor.server.request.receiveText
import io.ktor.server.response.header
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
    revertBatch: RevertDraftChangesUseCase,
    json: Json,
) {
    listChangeRoute(evaluator, list)
    summaryChangeRoute(evaluator, list)
    tokenIdsRoute(evaluator, list)
    revertChangeRoute(evaluator, revert, json)
    revertChangesRoute(evaluator, revertBatch, json)
    addressedRevertRoutes(evaluator, revertBatch, json)
}

private fun Route.addressedRevertRoutes(evaluator: PolicyEvaluator, useCase: RevertDraftChangesUseCase, json: Json) {
    val strict = Json(json) { ignoreUnknownKeys = false }
    post(dsRoutePath("/api/design-systems/{designSystemId}/changes/revert-by-address")) {
        val context = TrustedDsRequestContextMapper.map(
            call.dsTrustedHeaders(), evaluator,
            call.request.queryParameters["versionId"],
        ) ?: return@post call.respondFailure(DsFailure.Forbidden)
        val owner = call.dsPathDesignSystemId()?.uuid()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        val key = call.dsTrustedHeaders()["Idempotency-Key"]?.takeIf { it.isNotBlank() }
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("idempotency_key_required"))
        val body = call.receiveText()
        val request = runCatching {
            require(body.length <= MAX_REVERT_BATCH_BODY)
            strict.decodeFromString<AddressedRevertRequest>(body)
        }.getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("INVALID_REVERT_REQUEST"))
        val draft = request.draftId.uuid()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_draft_id"))
        val targets = request.targets.map { target ->
            val id = target.entityId.uuid()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_entity_id"))
            DraftAddressTarget(target.entityType, id, target.expectedRevision)
        }
        when (
            val result = useCase.executeAddressed(
                context.withIdempotentResponse { _: Unit ->
                    json.encodeToString(OkResponse())
                },
                DesignSystemId(owner),
                draft,
                targets,
                key,
            )
        ) {
            is DsResult.Success -> call.respondSuccess(result, OkResponse())
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
    post(dsRoutePath("/api/design-systems/{designSystemId}/changes/token-targets")) {
        val context = TrustedDsRequestContextMapper.map(
            call.dsTrustedHeaders(), evaluator,
            call.request.queryParameters["versionId"],
        ) ?: return@post call.respondFailure(DsFailure.Forbidden)
        val owner = call.dsPathDesignSystemId()?.uuid()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        val body = call.receiveText()
        val request = runCatching {
            require(body.length <= MAX_REVERT_BATCH_BODY)
            strict.decodeFromString<TokenTargetsRequest>(body)
        }.getOrNull() ?: return@post call.respondFailure(DsFailure.InvalidRequest("INVALID_TARGET_REQUEST"))
        val draft = request.draftId.uuid()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_draft_id"))
        val tenant = request.tenantId.uuid()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_tenant_id"))
        val ids = request.tokenIds.map {
            it.uuid()
                ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_token_id"))
        }
        if (ids.distinct().size != ids.size) {
            return@post call.respondFailure(DsFailure.InvalidRequest("duplicate_token_id"))
        }
        when (
            val result = useCase.tokenTargets(
                context,
                DesignSystemId(owner),
                draft,
                tenant,
                ids.toSet(),
                request.cursor,
            )
        ) {
            is DsResult.Success -> call.respondSuccess(
                result,
                TokenTargetsResponse(
                    result.value.draftId.toString(),
                    result.value.scopeRevision,
                    result.value.targets.map {
                        TokenTargetResponse(
                            it.target.entityType,
                            it.target.entityId.toString(),
                            it.target.expectedRevision,
                            it.operation,
                        )
                    },
                    result.value.nextCursor,
                ),
            )
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

/** Адресная команда полного пакетного отката. */
@Serializable
data class AddressedRevertRequest(
    /** Черновик, выбранный пользователем. */
    val draftId: String,
    /** Адреса в порядке отката. */
    val targets: List<AddressedRevertTargetRequest>,
)

/** Устойчивая сущность и ожидаемая предметная редакция. */
@Serializable
data class AddressedRevertTargetRequest(
    /** Зарегистрированный тип. */
    val entityType: String,
    /** Устойчивый предметный ID. */
    val entityId: String,
    /** Предметная редакция из выбранного снимка. */
    val expectedRevision: Long,
)

/** Ограниченная область чтения целей сброса инспектора. */
@Serializable
data class TokenTargetsRequest(
    /** Черновик чтения. */
    val draftId: String,
    /** Тема значений. */
    val tenantId: String,
    /** Определения выбранной области. */
    val tokenIds: List<String>,
    /** Продолжение согласованного снимка области. */
    val cursor: String? = null,
)

/** Страница адресных целей выбранной области. */
@Serializable
data class TokenTargetsResponse(
    /** Черновик целей. */
    val draftId: String,
    /** Отпечаток выбранной области. */
    val scopeRevision: String,
    /** Цели страницы. */
    val targets: List<TokenTargetResponse>,
    /** Следующая страница области. */
    val nextCursor: String?,
)

/** Адресная цель с видом изменения для предметных ограничений инспектора. */
@Serializable
data class TokenTargetResponse(
    /** Предметный тип. */
    val entityType: String,
    /** Устойчивый ID. */
    val entityId: String,
    /** Редакция цели. */
    val expectedRevision: Long,
    /** Создание, изменение или удаление. */
    val operation: String,
)

private fun Route.tokenIdsRoute(evaluator: PolicyEvaluator, list: ListDraftChangesUseCase) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/changes/token-ids")) {
        val context = call.modelReadContext(evaluator) ?: return@get
        val id = call.dsPathDesignSystemId()?.uuid()
            ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        val tenantId = call.request.queryParameters["tenantId"]?.uuid()
            ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_tenant_id"))
        when (val result = list.tokenIds(context, DesignSystemId(id), tenantId)) {
            is DsResult.Success -> call.respondSuccess(
                result,
                ChangedTokenIdsResponse(result.value.map(UUID::toString)),
            )
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

@Serializable
private data class ChangedTokenIdsResponse(val tokenIds: List<String>)

private fun Route.summaryChangeRoute(evaluator: PolicyEvaluator, list: ListDraftChangesUseCase) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/changes/summary")) {
        val context = call.modelReadContext(evaluator) ?: return@get
        val id = call.dsPathDesignSystemId()?.uuid()
            ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        val rawVersion = call.request.queryParameters["versionId"]
        val version = rawVersion?.uuid()
            ?: rawVersion?.let { return@get call.respondFailure(DsFailure.InvalidRequest("invalid_version_id")) }
        when (val result = list.summary(context, DesignSystemId(id), version?.let(::DesignSystemVersionId))) {
            is DsResult.Success -> call.respondSuccess(result, DraftChangeSummaryResponse(result.value))
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

private fun Route.listChangeRoute(evaluator: PolicyEvaluator, list: ListDraftChangesUseCase) {
    get(dsRoutePath("/api/design-systems/{designSystemId}/changes")) {
        val context = call.modelReadContext(evaluator) ?: return@get
        val designSystemId = call.dsPathDesignSystemId()?.uuid()
            ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        val rawVersionId = call.request.queryParameters["versionId"]
        val versionId = rawVersionId?.uuid()
            ?: rawVersionId?.let { return@get call.respondFailure(DsFailure.InvalidRequest("invalid_version_id")) }
        when (
            val result = list.snapshot(
                context,
                DesignSystemId(designSystemId),
                versionId?.let(::DesignSystemVersionId),
            )
        ) {
            is DsResult.Success -> {
                result.value.total?.let { call.response.header("X-DS-Journal-Total", it.toString()) }
                call.respondSuccess(result, result.value.changes.items.map(DraftChangeResponse::from))
            }
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

private fun Route.revertChangeRoute(evaluator: PolicyEvaluator, revert: RevertDraftChangeUseCase, json: Json) {
    val revertJson = Json(json) { ignoreUnknownKeys = false }
    post(dsRoutePath("/api/design-systems/{designSystemId}/changes/{changeId}/revert")) {
        val context = TrustedDsRequestContextMapper.map(
            call.dsTrustedHeaders(),
            evaluator,
            call.request.queryParameters["versionId"],
        )
            ?: return@post call.respondFailure(DsFailure.Forbidden)
        val designSystemId = call.dsPathDesignSystemId()?.uuid()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        val changeId = call.parameters["changeId"]?.uuid()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_change_id"))
        val revision = call.dsTrustedHeaders()["X-DS-Base-Revision"]?.toLongOrNull()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_base_revision"))
        val idempotencyKey = call.dsTrustedHeaders()["Idempotency-Key"]
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

private fun Route.revertChangesRoute(evaluator: PolicyEvaluator, revert: RevertDraftChangesUseCase, json: Json) {
    val revertJson = Json(json) { ignoreUnknownKeys = false }
    post(dsRoutePath("/api/design-systems/{designSystemId}/changes/revert")) {
        val context = TrustedDsRequestContextMapper.map(
            call.dsTrustedHeaders(),
            evaluator,
            call.request.queryParameters["versionId"],
        )
            ?: return@post call.respondFailure(DsFailure.Forbidden)
        val designSystemId = call.dsPathDesignSystemId()?.uuid()
            ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        val idempotencyKey = call.dsTrustedHeaders()["Idempotency-Key"]
        if (idempotencyKey.isNullOrBlank()) {
            return@post call.respondFailure(DsFailure.InvalidRequest("idempotency_key_required"))
        }
        val changes = when (val parsed = parseRevertBatchRequest(call.receiveText(), revertJson)) {
            is DsResult.Success -> parsed.value
            is DsResult.Failure -> return@post call.respondFailure(parsed.error)
        }
        when (
            val result = revert.execute(
                context.withIdempotentResponse { _: Unit -> json.encodeToString(OkResponse()) },
                DesignSystemId(designSystemId),
                changes,
                idempotencyKey,
            )
        ) {
            is DsResult.Success -> call.respondSuccess(result, OkResponse())
            is DsResult.Failure -> call.respondFailure(result.error)
        }
    }
}

private fun parseRevertBatchRequest(body: String, json: Json): DsResult<List<DraftChangeRevertTarget>> {
    if (body.length > MAX_REVERT_BATCH_BODY) {
        return DsResult.Failure(DsFailure.InvalidRequest("REVERT_BATCH_TOO_LARGE"))
    }
    // SerializationException наследует IllegalArgumentException: оба означают некорректное тело.
    val request = try {
        json.decodeFromString<RevertDraftChangesRequest>(body)
    } catch (_: IllegalArgumentException) {
        null
    }
    val changes = request?.changes?.map { change ->
        change.changeId.uuid()?.let { DraftChangeRevertTarget(it, change.expectedRevision) }
    }
    return when {
        changes == null -> DsResult.Failure(DsFailure.InvalidRequest("invalid_revert_request"))
        null in changes -> DsResult.Failure(DsFailure.InvalidRequest("invalid_change_id"))
        else -> DsResult.Success(changes.filterNotNull())
    }
}

private const val MAX_REVERT_BATCH_BODY = 65_536

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
