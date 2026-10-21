package com.dsbuilder.ds.designsystems.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DraftInvalidation
import com.dsbuilder.ds.core.application.DraftInvalidationScope
import com.dsbuilder.ds.core.application.DraftInvalidationStream
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.designsystems.application.GetDesignSystemDraftCursorUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondTextWriter
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.flow.produceIn
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import java.time.Instant
import java.util.UUID

/** Регистрирует поток уведомлений об изменении активного черновика. */
@Suppress("CyclomaticComplexMethod", "LongMethod")
fun Route.draftInvalidationRoutes(
    evaluator: PolicyEvaluator,
    getDraftCursor: GetDesignSystemDraftCursorUseCase,
    invalidations: DraftInvalidationStream,
    json: Json,
) {
    val connectionLimiter = DraftInvalidationConnectionLimiter(MAX_CONNECTIONS_PER_ACTOR)
    get("/api/ds/design-systems/{id}/events") {
        val context = TrustedDsRequestContextMapper.map(call.request.headers, evaluator)
            ?: return@get call.respondFailure(DsFailure.Forbidden)
        val designSystemId = call.parameters["id"]?.toUuidOrNull()
            ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
        val knownDraftId = call.request.queryParameters["draftId"]?.toUuidOrNull()
            ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_draft_id"))
        val knownRevision = call.request.queryParameters["draftRevision"]?.toLongOrNull()?.takeIf { it >= 0 }
            ?: return@get call.respondFailure(DsFailure.InvalidRequest("invalid_draft_revision"))
        if (context.clientId == null) {
            return@get call.respondFailure(DsFailure.InvalidRequest("client_id_required"))
        }
        val connectionLease = connectionLimiter.tryAcquire(context.projectId.value, context.principal.actorId)
            ?: return@get call.respond(HttpStatusCode.TooManyRequests)
        try {
            coroutineScope {
                val signals = merge(
                    invalidations.events
                        .filter { event -> event.designSystemId == designSystemId }
                        .map(DraftStreamSignal::Invalidated),
                    invalidations.reconnections.map(DraftStreamSignal::Reconnected),
                ).produceIn(this)
                try {
                    val activeCursor = when (
                        val result = getDraftCursor.execute(context, DesignSystemId(designSystemId))
                    ) {
                        is DsResult.Success -> result.value
                        is DsResult.Failure -> {
                            call.respondFailure(result.error)
                            return@coroutineScope
                        }
                    }
                    call.response.header(HttpHeaders.CacheControl, "no-cache")
                    call.response.header("X-Accel-Buffering", "no")
                    call.respondTextWriter(contentType = EVENT_STREAM_CONTENT_TYPE) {
                        var lastDraftId = knownDraftId
                        var lastRevision = knownRevision
                        val delivered = linkedSetOf<UUID>()
                        write("retry: $RETRY_MILLIS\n\n")
                        flush()
                        if (knownDraftId != activeCursor.draftId || knownRevision != activeCursor.draftRevision) {
                            val missed =
                                missedInvalidation(designSystemId, activeCursor.draftId, activeCursor.draftRevision)
                            writeEvent(json, missed)
                            lastDraftId = missed.draftId
                            lastRevision = activeCursor.draftRevision
                        }
                        withTimeoutOrNull(CONNECTION_MAX_MILLIS) stream@{
                            while (true) {
                                when (val signal = withTimeoutOrNull(HEARTBEAT_MILLIS) { signals.receive() }) {
                                    null -> {
                                        write(": heartbeat\n\n")
                                        flush()
                                    }
                                    is DraftStreamSignal.Invalidated -> {
                                        val event = signal.event
                                        val eventId = event.eventId
                                        if (eventId == null || event.draftId != lastDraftId) {
                                            val current = when (
                                                val result = getDraftCursor.execute(
                                                    context,
                                                    DesignSystemId(designSystemId),
                                                )
                                            ) {
                                                is DsResult.Success -> result.value
                                                is DsResult.Failure -> return@stream
                                            }
                                            writeEvent(
                                                json,
                                                missedInvalidation(
                                                    designSystemId,
                                                    current.draftId,
                                                    current.draftRevision,
                                                ),
                                            )
                                            lastDraftId = current.draftId
                                            lastRevision = current.draftRevision
                                        } else if (delivered.add(eventId)) {
                                            if (delivered.size > 512) delivered.remove(delivered.first())
                                            if (!isOwnDraftInvalidation(
                                                    context.principal.actorId,
                                                    context.clientId,
                                                    event,
                                                )
                                            ) {
                                                writeEvent(json, event)
                                            }
                                        }
                                    }
                                    is DraftStreamSignal.Reconnected -> {
                                        val current = when (
                                            val result = getDraftCursor.reconcile(
                                                context,
                                                DesignSystemId(designSystemId),
                                                signal.generation,
                                            )
                                        ) {
                                            is DsResult.Success -> result.value
                                            is DsResult.Failure -> return@stream
                                        }
                                        if (draftCursorChanged(
                                                current.draftId,
                                                current.draftRevision,
                                                lastDraftId,
                                                lastRevision,
                                            )
                                        ) {
                                            val missed = missedInvalidation(
                                                designSystemId,
                                                current.draftId,
                                                current.draftRevision,
                                            )
                                            writeEvent(json, missed)
                                            lastDraftId = missed.draftId
                                            lastRevision = current.draftRevision
                                        }
                                    }
                                }
                            }
                        }
                    }
                } finally {
                    signals.cancel()
                }
            }
        } finally {
            connectionLease.close()
        }
    }
}

@Serializable
private data class DraftInvalidationResponse(
    val eventId: String,
    val designSystemId: String,
    val draftId: String,
    val actorId: String,
    val clientId: String?,
    val changedAt: String,
    val scopes: Set<String>,
) {
    companion object {
        fun from(value: DraftInvalidation) = DraftInvalidationResponse(
            eventId = (value.eventId ?: UUID.randomUUID()).toString(),
            designSystemId = value.designSystemId.toString(),
            draftId = value.draftId.toString(),
            actorId = value.actorId,
            clientId = value.clientId,
            changedAt = value.changedAt.toString(),
            scopes = value.scopes.mapTo(linkedSetOf()) { it.wireName },
        )
    }
}

private suspend fun java.io.Writer.writeEvent(json: Json, event: DraftInvalidation) {
    val dto = DraftInvalidationResponse.from(event)
    val payload = json.encodeToJsonElement(DraftInvalidationResponse.serializer(), dto).jsonObject
    val response = event.draftRevision?.let { JsonObject(payload + ("draftRevision" to JsonPrimitive(it))) } ?: payload
    write("event: ${if (event.draftRevision == null) "draft-invalidated" else "draft-reconciled"}\n")
    write("id: ${dto.eventId}\n")
    write(
        "data: ${json.encodeToString(JsonObject.serializer(), response)}\n\n",
    )
    flush()
}

private fun missedInvalidation(designSystemId: UUID, draftId: UUID, draftRevision: Long) = DraftInvalidation(
    designSystemId = designSystemId,
    draftId = draftId,
    draftRevision = draftRevision,
    actorId = "system",
    clientId = null,
    changedAt = Instant.now(),
    scopes = setOf(DraftInvalidationScope.ALL),
)

internal fun isOwnDraftInvalidation(
    actorId: String,
    clientId: String?,
    event: DraftInvalidation,
): Boolean = clientId != null && event.clientId == clientId && event.actorId == actorId

internal fun draftInvalidationGap(event: DraftInvalidation, lastDraftId: UUID, lastRevision: Long): Boolean =
    event.draftId != lastDraftId || (event.draftRevision?.let { it > lastRevision + 1 } ?: false)

private sealed interface DraftStreamSignal {
    data class Invalidated(val event: DraftInvalidation) : DraftStreamSignal

    data class Reconnected(val generation: Long) : DraftStreamSignal
}

private fun String.toUuidOrNull(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()

private fun draftCursorChanged(
    currentDraftId: UUID?,
    currentRevision: Long?,
    lastDraftId: UUID,
    lastRevision: Long,
): Boolean {
    if (currentDraftId == null) return false
    if (currentRevision == null) return false
    return currentDraftId != lastDraftId || currentRevision != lastRevision
}

private val EVENT_STREAM_CONTENT_TYPE = ContentType.parse("text/event-stream")
private const val HEARTBEAT_MILLIS = 15_000L
private const val CONNECTION_MAX_MILLIS = 300_000L
private const val RETRY_MILLIS = 2_000
private const val MAX_CONNECTIONS_PER_ACTOR = 8
