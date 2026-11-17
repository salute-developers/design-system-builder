package com.dsbuilder.ai.chat.di

import com.dsbuilder.ai.chat.application.AgentLimits
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlin.time.Duration.Companion.seconds

/**
 * Провайдер модели.
 *
 * @property wireValue значение `AI_PROVIDER`.
 */
enum class AiProvider(val wireValue: String) { OPENAI_COMPATIBLE("openai-compatible"), GIGACHAT("gigachat") }

/** Настройки провайдера без секретов в строковом представлении. */
sealed interface ProviderSettings {
    /**
     * API формата OpenAI.
     *
     * @property baseUrl базовый адрес API.
     * @property apiKey ключ API.
     * @property model модель.
     * @property extraBody поля, подмешиваемые в тело запроса.
     * @property retryErrorCodes коды ошибок провайдера, при которых запрос повторяется.
     */
    data class OpenAiCompatible(
        val baseUrl: String,
        val apiKey: String,
        val model: String,
        val extraBody: JsonObject,
        val retryErrorCodes: Set<String>,
    ) : ProviderSettings {
        override fun toString() =
            "OpenAiCompatible(baseUrl=$baseUrl, model=$model, retryErrorCodes=$retryErrorCodes, apiKey=***)"
    }

    /**
     * GigaChat.
     *
     * @property oauthUrl адрес выдачи токена доступа.
     * @property baseUrl базовый адрес API.
     * @property authKey ключ авторизации.
     * @property scope область доступа.
     * @property model модель.
     * @property caPath путь к дополнительному корневому сертификату.
     */
    data class GigaChat(
        val oauthUrl: String,
        val baseUrl: String,
        val authKey: String,
        val scope: String,
        val model: String,
        val caPath: String?,
    ) : ProviderSettings {
        override fun toString() =
            "GigaChat(oauthUrl=$oauthUrl, baseUrl=$baseUrl, scope=$scope, model=$model, caPath=$caPath, authKey=***)"
    }
}

/**
 * Настройки ИИ-ассистента из env.
 *
 * При `AI_ENABLED` не `true` остальные `AI_*` не читаются. При `AI_ENABLED=true` ошибка в любой переменной
 * останавливает запуск с её именем, без значений секретов: так требует сценарий «Ошибочная конфигурация» монолита.
 *
 * @property enabled ассистент включён.
 * @property provider провайдер модели.
 * @property providerSettings настройки провайдера.
 * @property limits ограничения хода.
 */
data class AiAssistantConfiguration(
    val enabled: Boolean,
    val provider: AiProvider?,
    val providerSettings: ProviderSettings?,
    val limits: AgentLimits?,
) {
    /** Модель для `ai/status`. */
    val model: String? get() = when (val settings = providerSettings) {
        is ProviderSettings.OpenAiCompatible -> settings.model
        is ProviderSettings.GigaChat -> settings.model
        null -> null
    }

    private class Reader(private val env: (String) -> String?) {
        fun text(name: String, default: String): String = env(name)?.trim()?.takeIf(String::isNotEmpty) ?: default

        fun secret(name: String): String = env(name)?.trim()?.takeIf(String::isNotEmpty) ?: fail(name, "is required")

        fun positive(name: String, default: Int): Int {
            val raw = env(name)?.trim()?.takeIf(String::isNotEmpty) ?: return default
            return raw.toIntOrNull()?.takeIf { it > 0 } ?: fail(name, "must be a positive integer")
        }

        fun json(name: String, default: String): JsonObject {
            val raw = env(name)?.trim()?.takeIf(String::isNotEmpty) ?: default
            return runCatching { Json.parseToJsonElement(raw) as JsonObject }.getOrNull()
                ?: fail(name, "must be a JSON object")
        }

        fun list(name: String, default: String): Set<String> =
            text(name, default).split(',').map(String::trim).filter(String::isNotEmpty).toSet()

        fun fail(name: String, reason: String): Nothing =
            throw IllegalStateException("Invalid AI configuration: $name $reason")
    }

    companion object {

        /** Конфигурация выключенного ассистента. */
        val DISABLED = AiAssistantConfiguration(false, null, null, null)

        /** Читает настройки; [env] возвращает значение переменной или null. */
        fun fromEnvironment(env: (String) -> String?): AiAssistantConfiguration {
            if (env("AI_ENABLED")?.trim()?.lowercase() != "true") return DISABLED
            val reader = Reader(env)
            val provider = when (val raw = reader.text("AI_PROVIDER", AiProvider.OPENAI_COMPATIBLE.wireValue)) {
                AiProvider.OPENAI_COMPATIBLE.wireValue -> AiProvider.OPENAI_COMPATIBLE
                AiProvider.GIGACHAT.wireValue -> AiProvider.GIGACHAT
                else -> reader.fail("AI_PROVIDER", "must be openai-compatible or gigachat, got '$raw'")
            }
            val settings = when (provider) {
                AiProvider.OPENAI_COMPATIBLE -> ProviderSettings.OpenAiCompatible(
                    baseUrl = reader.text("AI_BASE_URL", "https://api.z.ai/api/paas/v4"),
                    apiKey = reader.secret("AI_API_KEY"),
                    model = reader.text("AI_MODEL", "glm-4.5-flash"),
                    extraBody = reader.json("AI_EXTRA_BODY", """{"thinking":{"type":"disabled"}}"""),
                    retryErrorCodes = reader.list("AI_RETRY_ERROR_CODES", "1234,1305"),
                )
                AiProvider.GIGACHAT -> ProviderSettings.GigaChat(
                    oauthUrl = reader.text("AI_GIGACHAT_OAUTH_URL", DEFAULT_GIGACHAT_OAUTH_URL),
                    baseUrl = reader.text("AI_GIGACHAT_BASE_URL", "https://api.giga.chat/v1"),
                    authKey = reader.secret("AI_GIGACHAT_AUTH_KEY"),
                    scope = reader.text("AI_GIGACHAT_SCOPE", "GIGACHAT_API_PERS"),
                    model = reader.text("AI_MODEL", "GigaChat-2-Max"),
                    caPath = env("AI_GIGACHAT_CA_PATH")?.trim()?.takeIf(String::isNotEmpty),
                )
            }
            val limits = AgentLimits(
                maxSteps = reader.positive("AI_MAX_STEPS", 12),
                maxWrites = reader.positive("AI_MAX_WRITES", 10),
                turnTimeout = reader.positive("AI_TURN_TIMEOUT_SECONDS", 120).seconds,
                historyMaxChars = reader.positive("AI_HISTORY_MAX_CHARS", 60_000),
                messageMaxChars = reader.positive("AI_MESSAGE_MAX_CHARS", 8_000),
                toolResultMaxChars = reader.positive("AI_TOOL_RESULT_MAX_CHARS", 6_000),
                toolCallTimeout = reader.positive("AI_TOOL_CALL_TIMEOUT_SECONDS", 30).seconds,
                turnStoreMaxBytes = reader.positive("AI_TURN_STORE_MAX_MB", 64).toLong() * BYTES_IN_MB,
            )
            return AiAssistantConfiguration(true, provider, settings, limits)
        }

        private const val BYTES_IN_MB = 1024L * 1024L
        private const val DEFAULT_GIGACHAT_OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    }
}
