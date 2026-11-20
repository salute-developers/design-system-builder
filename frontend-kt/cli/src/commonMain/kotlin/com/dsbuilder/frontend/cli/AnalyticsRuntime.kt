package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.analytics.metrica.MetricaConfig
import com.dsbuilder.frontend.analytics.metrica.MetricaIdentityStore
import com.dsbuilder.frontend.core.analytics.Analytics
import com.dsbuilder.frontend.core.analytics.AnalyticsEvent
import com.dsbuilder.frontend.core.analytics.AnalyticsValue
import com.dsbuilder.frontend.core.analytics.NoOpAnalytics
import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import com.dsbuilder.frontend.core.auth.CredentialStoreLock
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.process.isAbsolutePath
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import kotlin.random.Random
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

internal val CLI_ANALYTICS_OPERATIONS: Set<String> = setOf(
    "init", "status", "auth login", "auth status", "auth logout", "theme fetch", "theme generate",
    "theme alias list", "theme alias set", "theme alias unset", "components fetch", "components push",
    "components generate", "components import-api", "ds fetch", "ds generate", "docs init",
    "docs generate", "docs publish", "toolchain list", "toolchain doctor", "toolchain install",
    "preview-plugin publish",
)

/** Composition root аналитики. Фабрика вызывается лениво, только после первой операции. */
internal class CliAnalyticsSession(
    private val factory: (String, Set<String>) -> Analytics,
    private val consent: com.dsbuilder.frontend.core.analytics.AnalyticsConsent? = null,
    private val requireConsent: Boolean = false,
) {
    private val clients = mapOf(
        "cli" to MutableStateFlow<Analytics?>(null),
        "mcp" to MutableStateFlow<Analytics?>(null),
    )
    private val closed = MutableStateFlow(false)
    fun prepare(prompt: ((String) -> Boolean?)? = null) {
        recordSafely { runBlocking { consent?.prepare(prompt) } }
    }
    fun record(
        channel: String,
        operations: Set<String>,
        operation: String,
        outcome: String,
    ) {
        if (closed.value) return
        if (requireConsent && runBlocking { consent?.allowed() != true }) return
        val holder = clients.getValue(channel)
        val analytics = holder.value ?: factory(channel, operations).let { candidate ->
            if (holder.compareAndSet(null, candidate)) {
                candidate
            } else {
                candidate.close()
                requireNotNull(holder.value)
            }
        }
        if (closed.value) {
            analytics.close()
        } else {
            analytics.track(operationEvent(channel, operation, outcome))
        }
    }

    fun finish() {
        if (!closed.compareAndSet(false, true)) return
        for (analytics in clients.values.mapNotNull { it.value }) {
            recordSafely {
                runBlocking { analytics.flush(1500) }
            }
            recordSafely { analytics.close() }
        }
    }
}

private val operationEventNames = mapOf(
    "cli" to "cli_operation_finished",
    "mcp" to "mcp_tool_finished",
)

@OptIn(ExperimentalTime::class)
internal fun operationEvent(
    channel: String,
    operation: String,
    outcome: String,
): AnalyticsEvent =
    AnalyticsEvent(
        operationEventNames.getValue(channel),
        Clock.System.now().epochSeconds,
        mapOf("operation" to AnalyticsValue.Text(operation), "outcome" to AnalyticsValue.Text(outcome)),
    )

internal fun defaultAnalyticsSession(
    environment: EnvironmentReader,
    enabled: Boolean = BuiltAnalyticsConfig.enabled,
    consent: com.dsbuilder.frontend.core.analytics.AnalyticsConsent? = null,
    create: ((MetricaConfig, String) -> Analytics)? = null,
): CliAnalyticsSession =
    CliAnalyticsSession(
        factory = { channel, operations ->
            if (!enabled || analyticsRuntimeDisabled(environment)) {
                NoOpAnalytics
            } else {
                val config = MetricaConfig(
                    BuiltAnalyticsConfig.COUNTER_ID,
                    if (channel == "cli") BuiltAnalyticsConfig.CLI_TOKEN else BuiltAnalyticsConfig.MCP_TOKEN,
                    BuiltAnalyticsConfig.BASE_URL,
                    operations,
                )
                create?.invoke(config, channel) ?: platformAnalytics(config, channel) { consent?.allowed() == true }
            }
        },
        consent = consent,
        requireConsent = true,
    )

internal expect fun platformAnalytics(
    config: MetricaConfig,
    channel: String,
    allowed: suspend () -> Boolean = { true },
): Analytics

/** Проверяет отзыв непосредственно перед HTTP и отбрасывает старую очередь без повторной отправки. */
internal class ConsentMetricaTransport(
    private val delegate: com.dsbuilder.frontend.analytics.metrica.MetricaTransport,
    private val allowed: suspend () -> Boolean,
) : com.dsbuilder.frontend.analytics.metrica.MetricaTransport {
    override suspend fun send(request: com.dsbuilder.frontend.analytics.metrica.MetricaRequest): Boolean =
        if (allowed()) delegate.send(request) else false
    override fun close() = delegate.close()
}

/** Мост к уже существующим атомарной файловой записи и межпроцессной блокировке. */
internal class CliMetricaIdentityStore(
    private val fs: CredentialStoreFileSystem,
    private val lock: CredentialStoreLock,
    private val homeDirectory: () -> String = fs::homeDirectory,
) : MetricaIdentityStore {
    override suspend fun getOrCreateInstallationId(): String {
        val home = homeDirectory()
        require(isAbsolutePath(home))
        val directory = fs.resolve(home, ".dsbuilder/analytics")
        fs.createDirectories(directory)
        fs.setPosixPermissions(directory, "0700")
        val target = fs.resolve(directory, "installation-id")
        return lock.withLock(fs.resolve(directory, "identity.lock")) {
            if (fs.exists(target)) {
                fs.readText(target).trim().let { saved ->
                    require(saved.startsWith("1:"))
                    saved.removePrefix("1:")
                }.also { require(it.toLongOrNull()?.let { value -> value > 0 } == true) }
            } else {
                val id = Random.nextLong(1, Long.MAX_VALUE).toString()
                val temporary = fs.resolve(directory, "pending-$id")
                try {
                    fs.writeText(temporary, "1:$id")
                    fs.setPosixPermissions(temporary, "0600")
                    fs.atomicReplace(temporary, target)
                    id
                } finally { fs.deleteFile(temporary) }
            }
        }
    }
}

/** Ошибки телеметрии изолируются одинаково при регистрации и освобождении ресурсов. */
@Suppress("TooGenericExceptionCaught", "SwallowedException")
internal inline fun recordSafely(block: () -> Unit) {
    try {
        block()
    } catch (_: Exception) {
        // Без вывода: событие и исключение могут содержать непубличные данные.
    }
}
