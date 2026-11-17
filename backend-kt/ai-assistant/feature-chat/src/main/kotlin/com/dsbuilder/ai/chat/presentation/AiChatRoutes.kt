package com.dsbuilder.ai.chat.presentation

import com.dsbuilder.ai.chat.application.ChatAccess
import com.dsbuilder.ai.chat.application.ChatRejection
import com.dsbuilder.ai.chat.application.ChatTurnRequest
import com.dsbuilder.ai.chat.application.ChatTurnValidation
import com.dsbuilder.ai.chat.application.EventsResult
import com.dsbuilder.ai.chat.application.StartResult
import com.dsbuilder.ai.chat.application.StopResult
import com.dsbuilder.ai.chat.application.TurnOwner
import com.dsbuilder.ai.chat.di.AiAssistant
import com.dsbuilder.ai.chat.di.AiAssistantConfiguration
import com.dsbuilder.ai.chat.domain.ChatScope
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.authorization.TrustedProjectPrincipalFactory
import io.ktor.http.CacheControl
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receiveText
import io.ktor.server.response.cacheControl
import io.ktor.server.response.header
import io.ktor.server.response.respondText
import io.ktor.server.response.respondTextWriter
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.slf4j.LoggerFactory
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

private val log = LoggerFactory.getLogger("com.dsbuilder.ai.chat")

/**
 * Маршруты ИИ-чата внутри `/api/projects/{projectId}/ai`. [assistant] равен null, если чат выключен.
 * [trustedHeaders] возвращает проверенный контекст, построенный публичной границей монолита.
 */
fun Route.aiChatRoutes(
    assistant: AiAssistant?,
    evaluator: PolicyEvaluator,
    trustedHeaders: (ApplicationCall) -> Headers,
    heartbeat: Duration = 15.seconds,
) {
    get("/status") {
        call.respondJson(HttpStatusCode.OK, statusBody(assistant?.configuration))
    }

    post("/chat") {
        call.startTurn(assistant, evaluator, trustedHeaders)
    }

    get("/turns/{turnId}/events") {
        call.streamEvents(assistant, evaluator, trustedHeaders, heartbeat)
    }

    delete("/turns/{turnId}") {
        call.stopTurn(assistant, evaluator, trustedHeaders)
    }
}

private fun statusBody(configuration: AiAssistantConfiguration?): JsonObject = if (configuration == null) {
    buildJsonObject { put("enabled", false) }
} else {
    buildJsonObject {
        put("enabled", true)
        put("provider", configuration.provider?.wireValue)
        put("model", configuration.model)
        put("messageMaxChars", configuration.limits?.messageMaxChars)
    }
}

private suspend fun ApplicationCall.startTurn(
    assistant: AiAssistant?,
    evaluator: PolicyEvaluator,
    trustedHeaders: (ApplicationCall) -> Headers,
) {
    val (ai, principal) = authorized(assistant, evaluator, trustedHeaders) ?: return
    val valid = turnInput(ai) ?: return
    val scope = ChatScope(principal.actorId, principal.projectId, valid.designSystemId)
    val access = ChatAccess { permission -> evaluator.isAllowed(principal, permission) }
    when (val result = ai.start.start(valid, scope, principal, access)) {
        is StartResult.Accepted -> {
            log.info(
                "ai turn accepted project={} designSystem={} turn={}",
                scope.projectId,
                scope.designSystemId,
                result.turnId,
            )
            respondJson(HttpStatusCode.Accepted, buildJsonObject { put("turnId", result.turnId) })
        }
        is StartResult.Rejected -> reject(result.rejection)
    }
}

/** Проверенный запрос хода; при ошибке отвечает отказом и возвращает null. */
private suspend fun ApplicationCall.turnInput(ai: AiAssistant): ChatTurnRequest? {
    val key = request.headers["Idempotency-Key"]?.takeIf { it.isNotBlank() && it.length <= MAX_KEY_LENGTH }
    if (key == null) {
        reject(ChatRejection(BAD_REQUEST, INVALID_REQUEST))
        return null
    }
    val parsed = runCatching { ChatWire.request(receiveText(), key) }.getOrNull()
    return when (val validation = parsed?.let { ai.validate.validate(it) }) {
        null -> {
            reject(ChatRejection(BAD_REQUEST, INVALID_REQUEST))
            null
        }
        is ChatTurnValidation.Rejected -> {
            reject(validation.rejection)
            null
        }
        is ChatTurnValidation.Valid -> validation.request
    }
}

private suspend fun ApplicationCall.streamEvents(
    assistant: AiAssistant?,
    evaluator: PolicyEvaluator,
    trustedHeaders: (ApplicationCall) -> Headers,
    heartbeat: Duration,
) {
    val (ai, principal) = authorized(assistant, evaluator, trustedHeaders) ?: return
    val rawAfter = request.queryParameters["after"]
    val after = rawAfter?.toLongOrNull()?.takeIf { value -> value >= 0 }
    if (rawAfter != null && after == null) return reject(ChatRejection(BAD_REQUEST, INVALID_REQUEST))
    val owner = TurnOwner(principal.actorId, principal.projectId)
    val turnId = parameters["turnId"].orEmpty()
    when (val result = ai.turns.events(turnId, owner, after)) {
        EventsResult.Unknown -> reject(ChatRejection(NOT_FOUND, "turn_unknown"))
        EventsResult.TooManyStreams -> reject(ChatRejection(TOO_MANY_REQUESTS, "too_many_streams"))
        is EventsResult.Stream -> {
            if (after != null) log.info("ai turn reconnect turn={} after={}", turnId, after)
            respondStream(result, heartbeat)
        }
    }
}

private suspend fun ApplicationCall.respondStream(stream: EventsResult.Stream, heartbeat: Duration) {
    response.cacheControl(CacheControl.NoCache(null))
    response.header("X-Accel-Buffering", "no")
    try {
        respondTextWriter(ContentType.Text.EventStream) {
            val lock = Mutex()
            coroutineScope {
                val pulse = launch {
                    while (isActive) {
                        delay(heartbeat)
                        lock.withLock {
                            write(": heartbeat\n\n")
                            flush()
                        }
                    }
                }
                stream.flow.collect { stored ->
                    val (name, data) = ChatWire.event(stored.event)
                    lock.withLock {
                        write("id: ${stored.id}\nevent: $name\ndata: $data\n\n")
                        flush()
                    }
                }
                pulse.cancel()
            }
        }
    } finally {
        stream.release()
    }
}

private suspend fun ApplicationCall.stopTurn(
    assistant: AiAssistant?,
    evaluator: PolicyEvaluator,
    trustedHeaders: (ApplicationCall) -> Headers,
) {
    val (ai, principal) = authorized(assistant, evaluator, trustedHeaders) ?: return
    when (ai.turns.stop(parameters["turnId"].orEmpty(), TurnOwner(principal.actorId, principal.projectId))) {
        StopResult.STOPPED, StopResult.ALREADY_COMPLETED -> respondText("", status = HttpStatusCode.NoContent)
        StopResult.UNKNOWN -> reject(ChatRejection(NOT_FOUND, "turn_unknown"))
    }
}

/** Включённый ассистент и принципал проверенного контекста; иначе отвечает отказом и возвращает null. */
private suspend fun ApplicationCall.authorized(
    assistant: AiAssistant?,
    evaluator: PolicyEvaluator,
    trustedHeaders: (ApplicationCall) -> Headers,
): Pair<AiAssistant, ProjectPrincipal>? {
    if (assistant == null) {
        reject(ChatRejection(UNAVAILABLE, "ai_unavailable"))
        return null
    }
    val principal = principal(evaluator, trustedHeaders)
    if (principal == null) reject(ChatRejection(FORBIDDEN, "forbidden"))
    return principal?.let { assistant to it }
}

/** Принципал проверенного контекста; проект должен совпадать с проектом маршрута. */
private fun ApplicationCall.principal(
    evaluator: PolicyEvaluator,
    trustedHeaders: (ApplicationCall) -> Headers,
): ProjectPrincipal? {
    val headers = trustedHeaders(this)
    val principal = TrustedProjectPrincipalFactory.create(
        actorType = headers["X-Actor-Type"],
        projectId = headers["X-Project-Id"],
        userId = headers["X-User-Id"],
        projectKeyId = headers["X-Project-Key-Id"],
        projectRole = headers["X-Project-Role"],
        projectScopes = headers["X-Project-Scopes"],
        systemAdmin = headers["X-System-Admin"],
        policy = evaluator.policy,
        personalAccessTokenId = headers["X-Personal-Access-Token-Id"],
    ) ?: return null
    return principal.takeIf { it.projectId == parameters["projectId"] }
}

private suspend fun ApplicationCall.reject(rejection: ChatRejection) {
    val body = buildJsonObject {
        put("code", rejection.code)
        rejection.details.forEach { (key, value) -> put(key, JsonPrimitive(value)) }
    }
    respondJson(HttpStatusCode.fromValue(rejection.status), body)
}

private suspend fun ApplicationCall.respondJson(status: HttpStatusCode, body: JsonObject) =
    respondText(body.toString(), ContentType.Application.Json, status)

private const val BAD_REQUEST = 400
private const val FORBIDDEN = 403
private const val NOT_FOUND = 404
private const val TOO_MANY_REQUESTS = 429
private const val UNAVAILABLE = 503
private const val MAX_KEY_LENGTH = 255
private const val INVALID_REQUEST = "invalid_request"
