package com.dsbuilder.frontend.cli.analyticsadmin

import com.dsbuilder.frontend.cli.analyticsGoalIdentifiers
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.IOException
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.http.HttpTimeoutException
import java.time.Duration
import kotlin.system.exitProcess

private const val API = "https://api-metrika.yandex.net/management/v1"
private const val GOAL_LIMIT = 200

internal class GoalSyncFailure(message: String) : RuntimeException(message)

private fun requireSync(condition: Boolean, message: String) {
    if (!condition) throw GoalSyncFailure(message)
}

/** Административный HTTP: без редиректов, повторов и вывода тела ошибки. */
internal class MetricaGoalsApi(
    private val token: String,
    private val baseUrl: String = API,
) {
    private val client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER)
        .connectTimeout(Duration.ofSeconds(30)).build()

    fun request(counterId: String, payload: JsonObject? = null): JsonObject {
        val suffix = if (payload == null) "/goals?useDeleted=false" else ""
        val request = HttpRequest.newBuilder(URI.create("$baseUrl/counter/$counterId$suffix"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "OAuth $token")
            .header("Content-Type", "application/json")
        if (payload == null) request.GET() else request.PUT(HttpRequest.BodyPublishers.ofString(payload.toString()))
        return adminAttempt {
            val response = client.send(request.build(), HttpResponse.BodyHandlers.ofString())
            requireSync(
                response.statusCode() in 200..299,
                "Metrica API returned HTTP ${response.statusCode()}; no automatic retry.",
            )
            // PUT подтверждается отдельным GET: ответ изменения счётчика не нужен.
            if (payload != null) return@adminAttempt buildJsonObject {}
            val result = Json.parseToJsonElement(response.body()).jsonObject
            val errors = result["errors"]?.takeUnless { it == JsonNull }
            requireSync(errors?.jsonArray.isNullOrEmpty(), "Metrica API returned errors; no automatic retry.")
            result
        }
    }
}

// Более конкретные типы идут раньше родительских: timeout — IOException, JSON — IllegalArgumentException.
private val apiFailureReasons = linkedMapOf(
    HttpTimeoutException::class.java to "Metrica API request timed out",
    IOException::class.java to "Metrica API network or connection failure",
    SerializationException::class.java to "Metrica API returned invalid JSON",
    IllegalArgumentException::class.java to "Metrica API returned invalid goal data",
    NoSuchElementException::class.java to "Metrica API response is missing required fields",
    InterruptedException::class.java to "Metrica API request interrupted",
)

@Suppress("TooGenericExceptionCaught")
private inline fun <T> adminAttempt(block: () -> T): T = try {
    block()
} catch (failure: Exception) {
    if (failure is InterruptedException) Thread.currentThread().interrupt()
    val reason = apiFailureReasons.entries.firstOrNull { it.key.isInstance(failure) }?.value ?: throw failure
    throw GoalSyncFailure("$reason; no automatic retry. Rerun to read actual goals before continuing.")
}

private fun JsonObject.text(key: String): String = getValue(key).jsonPrimitive.content

private fun exactEvent(goal: JsonObject): String? {
    val condition = goal.takeIf { it.text("type") == "action" }
        ?.getValue("conditions")?.jsonArray?.singleOrNull()?.jsonObject
    return condition?.takeIf { it.text("type") == "exact" }?.text("url")
}

internal fun goalDefinition(event: String): JsonObject = buildJsonObject {
    put("name", event)
    put("type", "action")
    put(
        "conditions",
        JsonArray(
            listOf(
                buildJsonObject {
                    put("type", "exact")
                    put("url", event)
                },
            ),
        ),
    )
}

internal fun batchPayload(
    counterId: String,
    existing: Collection<JsonObject>,
    missing: List<String>,
): JsonObject = buildJsonObject {
    put(
        "counter",
        buildJsonObject {
            put("id", counterId.toLong())
            put("goals_remove", 0)
            put("goals", JsonArray(existing + missing.map(::goalDefinition)))
        },
    )
}

private fun readGoals(counterId: String, request: (String, JsonObject?) -> JsonObject): Map<Long, JsonObject> {
    val goals = request(counterId, null).getValue("goals").jsonArray.map { it.jsonObject }
    val byId = goals.associateBy { it.text("id").toLong() }
    require(byId.size == goals.size)
    require(byId.keys.all { it > 0 })
    return byId
}

internal fun syncGoals(
    counterId: String,
    events: List<String>,
    dryRun: Boolean,
    request: (String, JsonObject?) -> JsonObject,
    log: (String) -> Unit = ::println,
) {
    adminAttempt {
        val catalog = events.distinct()
        require(catalog.isNotEmpty())
        val before = readGoals(counterId, request)
        val goals = before.values
        val existing = goals.map(::exactEvent).toSet()
        val missing = catalog.filterNot { it in existing }
        requireSync(
            goals.none { it.text("name") in missing },
            "A catalog name is occupied by a different goal; resolve it manually.",
        )
        requireSync(
            goals.size + missing.size <= GOAL_LIMIT,
            "Plan exceeds the $GOAL_LIMIT-goal counter limit; nothing created.",
        )
        log(
            "Counter $counterId: catalog=${catalog.size}, " +
                "existing=${catalog.size - missing.size}, missing=${missing.size}",
        )
        if (dryRun || missing.isEmpty()) {
            missing.forEach { log("Would create $it") }
            log("Nothing changed.")
            return@adminAttempt
        }
        request(counterId, batchPayload(counterId, goals, missing))
        val after = readGoals(counterId, request)
        verifyBatch(catalog, before, after)
        log("Batch verified: created=${missing.size}, catalog=${catalog.size}, preserved=${before.size}.")
    }
}

private fun verifyBatch(catalog: List<String>, before: Map<Long, JsonObject>, after: Map<Long, JsonObject>) {
    val observed = after.values.map(::exactEvent).toSet()
    val differences: Map<String, Collection<*>> = mapOf(
        "missing" to catalog.filterNot { it in observed },
        "removed" to (before.keys - after.keys),
        "changed" to (before.keys intersect after.keys).filter { after[it] != before[it] },
    )
    val counts = differences.entries.joinToString { (kind, items) -> "$kind=${items.size}" }
    val details = differences.entries.joinToString { (kind, items) -> "$kind=$items" }
    requireSync(
        differences.values.all { it.isEmpty() },
        "Batch verification failed: $counts. $details. No automatic retry.",
    )
}

internal fun runSync(args: Array<String>, token: String, log: (String) -> Unit = ::println): Int {
    return try {
        val usage = "Use -PmetricaCounterId=<positive counter> and optionally -PmetricaDryRun=true."
        requireSync(args.size == 2, usage)
        requireSync(Regex("[1-9][0-9]*").matches(args[0]), usage)
        requireSync(args[1] in setOf("true", "false"), usage)
        requireSync(
            token.isNotBlank() && token.none(Char::isWhitespace),
            "Provide METRICA_OAUTH_TOKEN only to this administrative invocation.",
        )
        val api = MetricaGoalsApi(token)
        syncGoals(args[0], analyticsGoalIdentifiers(), args[1].toBooleanStrict(), api::request, log)
        0
    } catch (failure: GoalSyncFailure) {
        log("Error: ${failure.message}")
        1
    }
}

internal fun main(args: Array<String>) {
    exitProcess(runSync(args, System.getenv("METRICA_OAUTH_TOKEN").orEmpty().trim()))
}
