package com.dsbuilder.ai.chat.di

import com.dsbuilder.ai.chat.application.AgentToolbox
import com.dsbuilder.ai.chat.application.ChatAccessRefresher
import com.dsbuilder.ai.chat.application.ChatToolExecutor
import com.dsbuilder.ai.chat.application.ChatTurnScope
import com.dsbuilder.ai.chat.application.DesignSystemOwnership
import com.dsbuilder.ai.chat.application.LlmClient
import com.dsbuilder.ai.chat.application.RunChatTurnUseCase
import com.dsbuilder.ai.chat.application.StartChatTurnUseCase
import com.dsbuilder.ai.chat.application.SystemPrompt
import com.dsbuilder.ai.chat.application.TurnStore
import com.dsbuilder.ai.chat.application.ValidateChatTurnUseCase
import com.dsbuilder.ai.chat.data.CatalogAgentToolbox
import com.dsbuilder.ai.chat.data.GigaChatClient
import com.dsbuilder.ai.chat.data.GigaChatSettings
import com.dsbuilder.ai.chat.data.GigaChatTokenCache
import com.dsbuilder.ai.chat.data.HmacConfirmationSigner
import com.dsbuilder.ai.chat.data.InMemoryTurnStore
import com.dsbuilder.ai.chat.data.LlmRetry
import com.dsbuilder.ai.chat.data.OpenAiCompatibleClient
import com.dsbuilder.ai.chat.data.OpenAiCompatibleSettings
import com.dsbuilder.ai.chat.data.tools.ChatToolCatalog
import com.dsbuilder.ai.chat.domain.ChatScope
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import kotlinx.coroutines.Dispatchers
import java.io.File
import java.security.KeyStore
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/** Собранная подсистема ИИ-ассистента. */
class AiAssistant internal constructor(
    /** Настройки, с которыми собрана подсистема. */
    val configuration: AiAssistantConfiguration,
    /** Проверки формы запроса. */
    val validate: ValidateChatTurnUseCase,
    /** Запуск хода. */
    val start: StartChatTurnUseCase,
    /** Хранилище ходов для чтения событий и остановки. */
    val turns: TurnStore,
    /** Область ходов; закрывается при остановке монолита. */
    val turnScope: ChatTurnScope,
    private val drainToolCalls: suspend (Duration) -> Unit,
    private val clients: List<HttpClient>,
) : AutoCloseable {
    /** Перестаёт принимать ходы и ждёт начатые вызовы инструментов не дольше [grace]. */
    suspend fun shutdown(grace: Duration) {
        val started = kotlin.time.TimeSource.Monotonic.markNow()
        turnScope.shutdown(grace)
        drainToolCalls((grace - started.elapsedNow()).coerceAtLeast(Duration.ZERO))
    }

    override fun close() = clients.forEach(HttpClient::close)
}

/**
 * Собирает подсистему. [tools] выполняет инструменты каталога внутри процесса; инструмент каталога без обработчика
 * не даёт собрать подсистему. [access] актуализирует права участника перед каждым вызовом инструмента.
 * [llmOverride] подменяет провайдера модели в проверках монолита.
 */
fun createAiAssistant(
    configuration: AiAssistantConfiguration,
    ownership: DesignSystemOwnership,
    tools: ChatToolExecutor,
    access: ChatAccessRefresher,
    llmOverride: LlmClient? = null,
): AiAssistant {
    val settings = requireNotNull(configuration.providerSettings) { "AI assistant is disabled" }
    val limits = requireNotNull(configuration.limits)
    val providerHttp = providerHttpClient(configuration.caPath)
    val toolbox = CatalogAgentToolbox(ChatToolCatalog.tools, tools, limits.toolCallTimeout)
    checkHistoryBudget(toolbox, limits.historyMaxChars, limits.messageMaxChars, limits.toolResultMaxChars)
    val llm = llmOverride ?: llmClient(providerHttp, settings)
    val store = InMemoryTurnStore(limits.turnStoreMaxBytes)
    val signer = HmacConfirmationSigner()
    val turnScope = ChatTurnScope(Dispatchers.IO)
    val runner = RunChatTurnUseCase(llm, toolbox, signer, store, limits, access)
    return AiAssistant(
        configuration = configuration,
        validate = ValidateChatTurnUseCase(limits),
        start = StartChatTurnUseCase(store, ownership, signer, runner, turnScope),
        turns = store,
        turnScope = turnScope,
        drainToolCalls = toolbox::drain,
        clients = listOf(providerHttp),
    )
}

private val requestTimeout = 60.seconds

private fun llmClient(http: HttpClient, settings: ProviderSettings): LlmClient = when (settings) {
    is ProviderSettings.OpenAiCompatible -> OpenAiCompatibleClient(
        http,
        OpenAiCompatibleSettings(settings.baseUrl, settings.apiKey, settings.model, settings.extraBody),
        LlmRetry(settings.retryErrorCodes, requestTimeout),
    )
    is ProviderSettings.GigaChat -> {
        val giga =
            GigaChatSettings(settings.oauthUrl, settings.baseUrl, settings.authKey, settings.scope, settings.model)
        val retry = LlmRetry(emptySet(), requestTimeout, passThrough = setOf(UNAUTHORIZED))
        GigaChatClient(http, giga, GigaChatTokenCache(http, giga, retry), retry)
    }
}

private const val UNAUTHORIZED = 401
private const val CALL_RESERVE_CHARS = 2_000

/** Лимит истории должен вмещать промпт со схемами, сообщение предельной длины и один обмен «вызов + результат». */
private fun checkHistoryBudget(toolbox: AgentToolbox, historyMax: Int, messageMax: Int, toolResultMax: Int) {
    val prompt = SystemPrompt.build(
        ChatScope("", "", "00000000-0000-0000-0000-000000000000"),
        interrupted = true,
        context = SystemPrompt.LARGEST_CONTEXT,
    )
    val schemas = toolbox.specs { true }.sumOf {
        it.name.length + it.description.length + it.parameters.toString().length
    }
    val required = prompt.length + schemas + messageMax + toolResultMax + CALL_RESERVE_CHARS
    check(historyMax >= required) {
        "Invalid AI configuration: AI_HISTORY_MAX_CHARS ($historyMax) must fit the system prompt with tool schemas, " +
            "AI_MESSAGE_MAX_CHARS and AI_TOOL_RESULT_MAX_CHARS (at least $required)"
    }
}

/**
 * HTTP-клиент провайдера. Время запроса ограничивает [LlmRetry]; собственный таймаут движка CIO (15 секунд по
 * умолчанию) отключён, иначе он обрывает медленные ответы модели раньше. Корни из `AI_CA_PATH` добавляются к
 * системным, а не заменяют их, для любого провайдера.
 */
private fun providerHttpClient(caPath: String?): HttpClient {
    caPath ?: return HttpClient(CIO) { engine { requestTimeout = 0 } }
    val extra = File(caPath).inputStream().use { input ->
        CertificateFactory.getInstance("X.509").generateCertificates(input).filterIsInstance<X509Certificate>()
    }
    check(extra.isNotEmpty()) { "Invalid AI configuration: AI_CA_PATH contains no certificates" }
    val trust = CompositeTrustManager(systemTrustManager(null), systemTrustManager(extra))
    return HttpClient(CIO) {
        engine {
            requestTimeout = 0
            https { trustManager = trust }
        }
    }
}

private fun systemTrustManager(extra: List<X509Certificate>?): X509TrustManager {
    val store = extra?.let { certificates ->
        KeyStore.getInstance(KeyStore.getDefaultType()).apply {
            load(null, null)
            certificates.forEachIndexed { index, certificate -> setCertificateEntry("extra-$index", certificate) }
        }
    }
    val factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply { init(store) }
    return factory.trustManagers.filterIsInstance<X509TrustManager>().first()
}

/** Доверяет цепочке, если её принимает системный набор корней либо дополнительный. */
private class CompositeTrustManager(
    private val system: X509TrustManager,
    private val extra: X509TrustManager,
) : X509TrustManager {
    override fun checkClientTrusted(chain: Array<out X509Certificate>, authType: String) =
        system.checkClientTrusted(chain, authType)

    override fun checkServerTrusted(chain: Array<out X509Certificate>, authType: String) {
        runCatching { system.checkServerTrusted(chain, authType) }
            .recoverCatching { extra.checkServerTrusted(chain, authType) }
            .getOrThrow()
    }

    override fun getAcceptedIssuers(): Array<X509Certificate> = system.acceptedIssuers + extra.acceptedIssuers
}
