package com.dsbuilder.ai.eval

import com.dsbuilder.ai.chat.application.ChatToolKind
import com.dsbuilder.ai.chat.data.tools.ChatToolCatalog
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.File
import java.util.UUID
import kotlin.system.exitProcess

/**
 * Прогон эталонных сценариев ИИ-чата против поднятого контура через публичный API.
 *
 * Нужны `EVAL_GATEWAY_URL`, `EVAL_PROJECT_ID`, `EVAL_DESIGN_SYSTEM_ID` и токены `EVAL_EDITOR_TOKEN` и
 * `EVAL_MAINTAINER_TOKEN` (Bearer пользователей с ролями editor и maintainer). Без них или без доступного
 * контура прогон завершается ошибкой, а не пропуском. Провайдер и модель — те, с которыми запущен монолит.
 */
fun main(args: Array<String>) {
    val scenariosFile = File(args.firstOrNull() ?: "evals/scenarios.json")
    val env = { name: String -> System.getenv(name)?.takeIf(String::isNotBlank) ?: fail("$name is required") }
    val settings = EvalSettings(
        gateway = env("EVAL_GATEWAY_URL").trimEnd('/'),
        projectId = env("EVAL_PROJECT_ID"),
        designSystemId = env("EVAL_DESIGN_SYSTEM_ID"),
        tokens = mapOf("editor" to env("EVAL_EDITOR_TOKEN"), "maintainer" to env("EVAL_MAINTAINER_TOKEN")),
    )
    val scenarios = Json.parseToJsonElement(scenariosFile.readText()).jsonObject.getValue("scenarios").jsonArray
    val results = HttpClient(CIO).use { http ->
        runBlocking {
            val status = http.get("${settings.ai}/status") { bearer(settings.tokens.getValue("editor")) }
            if (!status.status.isSuccess() || !status.bodyAsText().contains("\"enabled\":true")) {
                fail("AI chat is not enabled on ${settings.gateway}: HTTP ${status.status.value}")
            }
            scenarios.map { runScenario(http, settings, it.jsonObject) }
        }
    }
    println()
    println("| Сценарий | Итог | Причина |")
    println("|---|---|---|")
    results.forEach { println("| ${it.id} | ${if (it.passed) "прошёл" else "не прошёл"} | ${it.reason} |") }
    val failed = results.count { !it.passed }
    println()
    println("Прошло ${results.size - failed} из ${results.size}")
    if (failed > 0) exitProcess(1)
}

private data class EvalSettings(
    val gateway: String,
    val projectId: String,
    val designSystemId: String,
    val tokens: Map<String, String>,
) {
    val ai get() = "$gateway/api/projects/$projectId/ai"
    val changes get() = "$gateway/api/projects/$projectId/design-systems/$designSystemId/changes/summary"
}

private data class EvalResult(val id: String, val passed: Boolean, val reason: String)

private suspend fun runScenario(http: HttpClient, settings: EvalSettings, scenario: JsonObject): EvalResult {
    val id = scenario.text("id")
    val token = settings.tokens.getValue(scenario.text("role").ifEmpty { "editor" })
    val expect = scenario.getValue("expect").jsonObject
    val journalBefore = journal(http, settings, token)
    val start = http.post("${settings.ai}/chat") {
        bearer(token)
        header("Idempotency-Key", UUID.randomUUID().toString())
        contentType(ContentType.Application.Json)
        setBody(
            buildJsonObject {
                put("designSystemId", settings.designSystemId)
                put(
                    "messages",
                    buildJsonArray {
                        add(
                            buildJsonObject {
                                put("role", "user")
                                put("text", scenario.text("prompt"))
                            },
                        )
                    },
                )
            }.toString(),
        )
    }
    if (start.status.value != ACCEPTED) return EvalResult(id, false, "POST /ai/chat: HTTP ${start.status.value}")
    val turnId = Json.parseToJsonElement(start.bodyAsText()).jsonObject.text("turnId")
    val events = http.get("${settings.ai}/turns/$turnId/events") { bearer(token) }.bodyAsText()
        .split("\n\n").mapNotNull(::parseEvent)
    val writes = successfulWrites(events)
    val confirmation = events.firstOrNull { it.first == "confirmation_required" }?.second?.text("tool")
    val error = events.firstOrNull { it.first == "error" }?.second?.text("code")
    val journalAfter = journal(http, settings, token)
    val outcome = TurnOutcome(writes, confirmation, error, journalBefore, journalAfter)
    val problems = problems(expect, outcome)
    return EvalResult(id, problems.isEmpty(), problems.joinToString("; ").ifEmpty { "ок" })
}

/** Инструменты записи каталога; чтения записями не считаются. */
private val writeTools: Set<String> =
    ChatToolCatalog.tools.filter { it.kind != ChatToolKind.READ }.map { it.name }.toSet()

/** Успешные вызовы инструментов записи из событий хода. */
internal fun successfulWrites(events: List<Pair<String, JsonObject>>): List<String> = events
    .filter { (type, data) -> type == "tool_result" && (data["isError"] as? JsonPrimitive)?.booleanOrNull == false }
    .map { it.second.text("tool") }
    .filter { it in writeTools }

/** Наблюдаемый итог хода для сверки с ожиданиями сценария. */
internal data class TurnOutcome(
    val writes: List<String>,
    val confirmation: String?,
    val error: String?,
    val journalBefore: Long,
    val journalAfter: Long,
)

/** Расхождения итога хода с ожиданиями сценария. */
internal fun problems(expect: JsonObject, outcome: TurnOutcome): List<String> = buildList {
    val writes = outcome.writes
    val confirmation = outcome.confirmation
    val journalBefore = outcome.journalBefore
    val journalAfter = outcome.journalAfter
    val expectedWrites = (expect["writeTools"] as? JsonArray).orEmpty().map { it.jsonPrimitive.content }
    expectedWrites.filterNot { it in writes }.forEach { add("нет успешной записи $it") }
    if (expectedWrites.isEmpty() && writes.isNotEmpty()) add("лишние записи: ${writes.joinToString()}")
    val journalGrows = (expect["journalGrows"] as? JsonPrimitive)?.booleanOrNull == true
    if (journalGrows && journalAfter <= journalBefore) add("журнал DS не изменился")
    if (!journalGrows && journalAfter != journalBefore) add("журнал DS изменился")
    val wantsConfirmation = (expect["confirmation"] as? JsonPrimitive)?.booleanOrNull == true
    if (wantsConfirmation && confirmation != expect.text("confirmationTool")) {
        add("нет подтверждения ${expect.text("confirmationTool")}")
    }
    if (!wantsConfirmation && confirmation != null) add("неожиданное подтверждение $confirmation")
    outcome.error?.let { add("ошибка хода $it") }
}

/** Состояние DS через API: число изменений в журнале черновика. */
private suspend fun journal(http: HttpClient, settings: EvalSettings, token: String): Long {
    val response = http.get(settings.changes) { bearer(token) }
    if (!response.status.isSuccess()) fail("GET changes/summary: HTTP ${response.status.value}")
    val body = response.bodyAsText()
    return Regex("\"total\"\\s*:\\s*(\\d+)").find(body)?.groupValues?.get(1)?.toLong()
        ?: fail("changes/summary has no total")
}

private fun parseEvent(block: String): Pair<String, JsonObject>? {
    val type = block.lines().firstOrNull { it.startsWith("event:") }?.removePrefix("event:")?.trim() ?: return null
    val data = block.lines().filter { it.startsWith("data:") }.joinToString("\n") { it.removePrefix("data:").trim() }
    return type to (runCatching { Json.parseToJsonElement(data).jsonObject }.getOrNull() ?: JsonObject(emptyMap()))
}

private fun io.ktor.client.request.HttpRequestBuilder.bearer(token: String) = header(
    HttpHeaders.Authorization,
    "Bearer $token",
)

private fun JsonObject.text(name: String): String = (get(name) as? JsonPrimitive)?.content.orEmpty()

private fun fail(message: String): Nothing {
    System.err.println("evalChat: $message")
    exitProcess(2)
}

private const val ACCEPTED = 202
