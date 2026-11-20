@file:Suppress("TooGenericExceptionCaught", "SwallowedException")
// Сбой необязательной аналитики не должен нарушать основную операцию.

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.analytics.AnalyticsConsent
import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import com.dsbuilder.frontend.core.auth.CredentialStoreLock
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.PkcePlatform
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Url
import io.ktor.http.contentType
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.io.encoding.Base64
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

@Serializable
internal data class ConsentPolicyDto(val version: String, val sha256: String, val text: String)

@Serializable
internal data class ConsentReceiptDto(
    val revision: Long,
    val decision: String,
    @SerialName("policy_version") val policyVersion: String,
    @SerialName("policy_sha256") val policySha256: String,
    @SerialName("received_at") val receivedAt: String,
)

@Serializable
internal data class ConsentStateDto(
    val revision: Long,
    @SerialName("analytics_allowed") val analyticsAllowed: Boolean,
    val receipt: ConsentReceiptDto?,
)

@Serializable
internal data class ConsentResponseDto(
    val policy: ConsentPolicyDto,
    val current: ConsentStateDto,
    val receipt: ConsentReceiptDto? = null,
)

@Serializable
internal data class ConsentDecisionDto(
    @SerialName("request_id") val requestId: String,
    val decision: String,
    @SerialName("expected_revision") val expectedRevision: Long,
    @SerialName("policy_version") val policyVersion: String? = null,
    @SerialName("policy_sha256") val policySha256: String? = null,
    @SerialName("client_group") val clientGroup: String = "cli_mcp",
    @SerialName("app_version") val appVersion: String = VERSION,
)

@Serializable
internal data class SavedConsent(
    val key: String,
    val decision: String? = null,
    val revision: Long = 0,
    val receipt: ConsentReceiptDto? = null,
    val pending: ConsentDecisionDto? = null,
)

@Serializable
private data class ConsentFile(val environments: Map<String, SavedConsent> = emptyMap())

/** Общий файл установки. Сеть никогда не выполняется под файловой блокировкой. */
internal class CliConsentFile(
    private val fs: CredentialStoreFileSystem,
    private val lock: CredentialStoreLock,
    private val environment: String,
    private val newKey: () -> String,
) {
    private val json = Json { ignoreUnknownKeys = true }
    private fun directory() = fs.resolve(fs.homeDirectory(), ".dsbuilder/privacy")
    suspend fun read(): SavedConsent? = access(false) { it }
    suspend fun change(
        transform: (SavedConsent) -> SavedConsent,
    ): SavedConsent = requireNotNull(access(true, transform))
    private suspend fun access(write: Boolean, transform: (SavedConsent) -> SavedConsent): SavedConsent? {
        val directory = directory()
        if (!write && !fs.exists(directory)) return null
        fs.createDirectories(directory)
        fs.setPosixPermissions(directory, "0700")
        return withTimeout(1000) {
            lock.withLock(fs.resolve(directory, "consent.lock")) {
                val target = fs.resolve(directory, "analytics-consent.json")
                val file = if (fs.exists(target)) {
                    json.decodeFromString<ConsentFile>(fs.readText(target))
                } else {
                    ConsentFile()
                }
                val previous = file.environments[environment]
                if (previous != null) {
                    require(previous.key.matches(Regex("[a-f0-9]{64}")) && previous.revision >= 0)
                    require(previous.decision in setOf(null, "granted", "denied", "withdrawn"))
                }
                if (!write) return@withLock previous
                val updated = transform(previous ?: SavedConsent(newKey()))
                val temporary = fs.resolve(directory, "pending-consent")
                try {
                    val content = json.encodeToString(ConsentFile(file.environments + (environment to updated)))
                    fs.writeText(temporary, content)
                    fs.setPosixPermissions(temporary, "0600")
                    fs.atomicReplace(temporary, target)
                    fs.setPosixPermissions(target, "0600")
                    check(fs.readText(target) == content)
                } finally { fs.deleteFile(temporary) }
                updated
            }
        }
    }
}

/** Проверка разрешения один раз за запуск с немедленным локальным запретом. */
@OptIn(ExperimentalUuidApi::class)
internal class CliConsentSession(
    private val file: CliConsentFile,
    private val client: () -> HttpClient,
    private val baseUrl: String,
    private val automatic: Boolean,
) : AnalyticsConsent {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }
    private var http: HttpClient? = null
    private var prepared = false
    private var confirmed: SavedConsent? = null

    override suspend fun prepare(prompt: ((String) -> Boolean?)?) {
        if (prepared || !automatic) return
        prepared = true
        try {
            val question = withTimeout(1000) { inspectSavedChoice(prompt != null) }
            if (question != null && prompt != null) {
                val answer = prompt(question.second.policy.text)
                if (answer != null) {
                    withTimeout(1000) { choose(if (answer) "granted" else "denied", question.second, question.first) }
                }
            }
        } catch (_: Exception) { confirmed = null }
    }

    private suspend fun inspectSavedChoice(canPrompt: Boolean): Pair<SavedConsent, ConsentResponseDto>? {
        val saved = file.read()
        return when {
            saved?.pending != null -> {
                sync(saved)
                null
            }
            saved?.decision in setOf("denied", "withdrawn") -> null
            saved?.decision == "granted" || canPrompt -> checkSavedChoice()
            else -> null
        }
    }

    private suspend fun checkSavedChoice(): Pair<SavedConsent, ConsentResponseDto>? {
        val saved = file.change { it }
        val response = get(saved)
        val checked = file.change { if (it == saved) it.copy(revision = response.current.revision) else it }
        if (checked != saved.copy(revision = response.current.revision)) return null
        if (saved.decision == "granted" && response.current.analyticsAllowed) {
            confirmed = checked
            return null
        }
        return checked to response
    }

    override suspend fun allowed(): Boolean {
        if (!automatic) return false
        val expected = confirmed ?: return false
        return try {
            confirmed = withTimeout(1000) { file.read()?.takeIf { it == expected } }
            confirmed != null
        } catch (_: Exception) {
            confirmed = null
            false
        }
    }

    override suspend fun enable(prompt: (String) -> Boolean?): String {
        confirmed = null
        return try {
            var saved = withTimeout(1000) { file.change { it } }
            if (saved.pending != null) {
                withTimeout(1000) { sync(saved) }
                if (saved.pending?.decision == "granted") return "Результат предыдущего запроса получен."
                saved = withTimeout(1000) { file.change { it } }
            }
            val response = withTimeout(1000) { get(saved) }
            val answer = prompt(response.policy.text) ?: return "Выбор не изменён."
            choose(if (answer) "granted" else "denied", response, saved)
            when {
                answer && allowed() -> "Аналитика разрешена."
                answer -> "Выбор сохранён; сбор отключён окружением."
                else -> "Аналитика отключена."
            }
        } catch (_: Exception) { "Не удалось подтвердить выбор. Аналитика отключена; повторите analytics enable." }
    }

    override suspend fun disable(): String {
        confirmed = null
        return try {
            val saved = file.change { previous ->
                previous.copy(
                    decision = "withdrawn",
                    pending = ConsentDecisionDto(Uuid.random().toString(), "withdrawn", previous.revision),
                )
            }
            try { withTimeout(1000) { sync(saved) } } catch (_: Exception) { /* Локальный запрет уже сохранён. */ }
            "Аналитика отключена."
        } catch (_: Exception) {
            "Аналитика отключена в этом процессе; не удалось сохранить отзыв. " +
                "Повторите analytics disable."
        }
    }

    override suspend fun status(): String = try {
        when (file.read()?.decision) {
            "granted" -> "Сохранено разрешение. Проверяется при следующем рабочем запуске."
            "denied", "withdrawn" -> "Аналитика отключена."
            else -> "Разрешение не предоставлено. Аналитика отключена."
        }
    } catch (_: Exception) { "Выбор недоступен. Аналитика отключена." }

    private suspend fun choose(
        decision: String,
        response: ConsentResponseDto,
        expected: SavedConsent,
    ) {
        confirmed = null
        val saved = file.change {
            check(decision != "granted" || it == expected)
            it.copy(
                decision = decision,
                revision = response.current.revision,
                pending = ConsentDecisionDto(
                    Uuid.random().toString(),
                    decision,
                    response.current.revision,
                    if (decision == "granted") response.policy.version else null,
                    if (decision == "granted") response.policy.sha256 else null,
                ),
            )
        }
        withTimeout(1000) { sync(saved) }
    }

    private suspend fun sync(saved: SavedConsent) {
        val pending = saved.pending ?: return
        var active = saved
        var response = post(active, pending)
        if (response == null) {
            val latest = get(saved)
            if (pending.decision == "granted") {
                file.change {
                    if (it == saved) {
                        it.copy(
                            revision = latest.current.revision,
                            decision = null,
                            pending = null,
                        )
                    } else {
                        it
                    }
                }
                error("Consent choice changed")
            }
            active = file.change {
                if (it == saved) {
                    it.copy(
                        pending = pending.copy(
                            requestId = Uuid.random().toString(), expectedRevision = latest.current.revision,
                        ),
                    )
                } else {
                    it
                }
            }
            if (active.decision != saved.decision) return
            response = post(active, requireNotNull(active.pending))
        }
        check(response != null)
        val acknowledged = active.copy(revision = response.current.revision, receipt = response.receipt, pending = null)
        val updated = file.change { if (it == active) acknowledged else it }
        if (updated == acknowledged && updated.decision == "granted" && response.current.analyticsAllowed) {
            confirmed = updated
        }
    }

    private fun http(saved: SavedConsent): HttpClient {
        require(saved.key.matches(Regex("[a-f0-9]{64}")))
        val url = Url(baseUrl)
        require(url.protocol.name == "https" || url.host in setOf("localhost", "127.0.0.1"))
        return http ?: client().also { http = it }
    }
    private suspend fun get(saved: SavedConsent): ConsentResponseDto {
        val response = http(saved).get("$baseUrl/api/privacy/analytics/consent?client_group=cli_mcp") {
            header("X-Consent-Key", saved.key)
        }
        check(response.status.value == 200)
        return json.decodeFromString(response.bodyAsText())
    }
    private suspend fun post(saved: SavedConsent, input: ConsentDecisionDto): ConsentResponseDto? {
        val response = http(saved).post("$baseUrl/api/privacy/analytics/consent") {
            header("X-Consent-Key", saved.key)
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(input))
        }
        if (response.status.value == 409) return null
        check(response.status.value in setOf(200, 201))
        return json.decodeFromString(response.bodyAsText())
    }
    override fun close() {
        http?.close()
        http = null
        confirmed = null
        prepared = false
    }
}

internal fun createCliConsent(
    fs: CredentialStoreFileSystem,
    lock: CredentialStoreLock,
    environment: EnvironmentReader,
    crypto: PkcePlatform,
    client: () -> HttpClient,
): AnalyticsConsent {
    val automatic = BuiltAnalyticsConfig.enabled && !analyticsRuntimeDisabled(environment)
    val session = lazy {
        val url = ApiUrlResolver(environment).resolve(null).value.trimEnd('/')
        CliConsentSession(
            CliConsentFile(fs, lock, "$url|${BuiltAnalyticsConfig.COUNTER_ID}") {
                Base64.UrlSafe.withPadding(Base64.PaddingOption.ABSENT).decode(crypto.generate().state)
                    .also { require(it.size == 32) }
                    .joinToString("") { byte -> byte.toUByte().toString(16).padStart(2, '0') }
            },
            client,
            url,
            automatic,
        )
    }
    return object : AnalyticsConsent {
        override suspend fun prepare(prompt: ((String) -> Boolean?)?) {
            if (automatic) session.value.prepare(prompt)
        }
        override suspend fun allowed(): Boolean = automatic && session.isInitialized() && session.value.allowed()
        override suspend fun enable(prompt: (String) -> Boolean?) = session.value.enable(prompt)
        override suspend fun disable() = session.value.disable()
        override suspend fun status() = session.value.status()
        override fun close() { if (session.isInitialized()) session.value.close() }
    }
}

internal fun analyticsRuntimeDisabled(environment: EnvironmentReader): Boolean =
    environment.get("CI")?.lowercase() in setOf("true", "1") ||
        listOf("DSBUILDER_ANALYTICS_DISABLED", "DO_NOT_TRACK").any { environment.get(it) == "1" }
