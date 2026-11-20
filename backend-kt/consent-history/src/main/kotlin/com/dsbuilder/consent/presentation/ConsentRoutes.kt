package com.dsbuilder.consent.presentation

import com.dsbuilder.consent.application.ConsentHistory
import com.dsbuilder.consent.application.sha256
import com.dsbuilder.consent.domain.ConsentConflict
import com.dsbuilder.consent.domain.ConsentInput
import com.dsbuilder.consent.domain.ConsentReceipt
import com.dsbuilder.consent.domain.ConsentScope
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receiveText
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.sql.SQLException
import java.util.UUID

@Serializable
private data class DecisionDto(
    @SerialName("request_id") val requestId: String,
    @SerialName("client_group") val clientGroup: String,
    val decision: String,
    @SerialName("expected_revision") val expectedRevision: Long,
    @SerialName("policy_version") val policyVersion: String? = null,
    @SerialName("policy_sha256") val policySha256: String? = null,
    @SerialName("app_version") val appVersion: String? = null,
)

@Serializable
private data class ReceiptDto(
    val revision: Long,
    @SerialName("request_id") val requestId: String,
    val decision: String,
    @SerialName("policy_version") val policyVersion: String,
    @SerialName("policy_sha256") val policySha256: String,
    @SerialName("received_at") val receivedAt: String,
    @SerialName("app_version") val appVersion: String?,
)

@Serializable
private data class StateDto(
    val revision: Long,
    @SerialName("analytics_allowed") val analyticsAllowed: Boolean,
    val receipt: ReceiptDto?,
)

@Serializable
private data class PolicyDto(val version: String, val sha256: String, val text: String)

@Serializable
private data class ResponseDto(val policy: PolicyDto, val current: StateDto, val receipt: ReceiptDto? = null)

private fun ConsentReceipt.dto() = ReceiptDto(
    revision,
    requestId,
    decision,
    policyVersion,
    policySha256,
    receivedAt,
    appVersion,
)

/** Регистрирует только чтение своего состояния и запись решения. Gateway ограничивает тело до 4 КиБ. */
fun Route.consentRoutes(history: ConsentHistory) {
    val limiter = ConsentRequestLimit()
    val json = Json { ignoreUnknownKeys = false }
    get("/api/privacy/analytics/consent") {
        call.consentRequest(limiter) { hash ->
            val scope = ConsentScope(hash, requireGroup(call.request.queryParameters["client_group"]))
            val response = response(history, scope, history.current(scope))
            call.respond(HttpStatusCode.OK, response)
        }
    }
    post("/api/privacy/analytics/consent") {
        call.consentRequest(limiter) { hash ->
            val raw = call.receiveText()
            if (raw.toByteArray().size > 4096) {
                call.respond(HttpStatusCode.PayloadTooLarge)
            } else {
                val dto = json.decodeFromString<DecisionDto>(raw)
                val scope = ConsentScope(hash, requireGroup(dto.clientGroup))
                require(UUID.fromString(dto.requestId).toString() == dto.requestId)
                require(dto.expectedRevision in 0 until Long.MAX_VALUE)
                require(dto.decision in setOf("granted", "denied", "withdrawn"))
                require(dto.appVersion.orEmpty().length <= 64)
                if (dto.decision == "granted") {
                    requireNotNull(dto.policyVersion)
                    require(dto.policySha256?.matches(Regex("[a-f0-9]{64}")) == true)
                } else {
                    require(dto.policyVersion == null && dto.policySha256 == null)
                }
                val input = ConsentInput(
                    dto.requestId,
                    dto.decision,
                    dto.expectedRevision,
                    dto.policyVersion,
                    dto.policySha256,
                    dto.appVersion,
                )
                val result = history.record(scope, input)
                call.respond(
                    if (result.created) HttpStatusCode.Created else HttpStatusCode.OK,
                    response(history, scope, result.current, result.receipt),
                )
            }
        }
    }
}

private fun requireGroup(group: String?): String {
    require(group in setOf("web", "cli_mcp"))
    return requireNotNull(group)
}

private fun response(
    history: ConsentHistory,
    scope: ConsentScope,
    current: ConsentReceipt?,
    receipt: ConsentReceipt? = null,
): ResponseDto {
    val policy = history.policy(scope.clientGroup)
    val allowed = current?.decision == "granted" && current.policyVersion == policy.version &&
        current.policySha256 == policy.sha256
    return ResponseDto(
        PolicyDto(policy.version, policy.sha256, policy.text),
        StateDto(current?.revision ?: 0, allowed, current?.dto()),
        receipt?.dto(),
    )
}

private suspend fun io.ktor.server.application.ApplicationCall.consentRequest(
    limiter: ConsentRequestLimit,
    block: suspend (String) -> Unit,
) {
    response.header(HttpHeaders.CacheControl, "no-store")
    val key = request.headers["X-Consent-Key"].orEmpty()
    if (!key.matches(Regex("[a-f0-9]{64}"))) {
        respond(HttpStatusCode.Unauthorized)
        return
    }
    val hash = sha256(key.toByteArray())
    if (!limiter.allow(hash)) {
        respond(HttpStatusCode.TooManyRequests)
        return
    }
    try {
        block(hash)
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: ConsentConflict) {
        respond(HttpStatusCode.Conflict)
    } catch (_: SerializationException) {
        respond(HttpStatusCode.BadRequest)
    } catch (_: IllegalArgumentException) {
        respond(HttpStatusCode.BadRequest)
    } catch (_: SQLException) {
        respond(HttpStatusCode.ServiceUnavailable)
    }
}

/** Ограниченная по памяти защита публичного журнала от повторных запросов одного ключа. */
private class ConsentRequestLimit {
    private val windows = mutableMapOf<String, Pair<Long, Int>>()

    @Synchronized fun allow(hash: String): Boolean {
        val minute = System.nanoTime() / 60_000_000_000L
        windows.entries.removeIf { it.value.first != minute }
        val current = windows[hash] ?: (minute to 0)
        if (current.second >= 60 || windows.size >= 10000 && hash !in windows) return false
        windows[hash] = minute to current.second + 1
        return true
    }
}
