package com.dsbuilder.frontend.analytics.metrica

import com.dsbuilder.frontend.core.analytics.AnalyticsContext
import io.ktor.http.URLProtocol
import io.ktor.http.Url

/**
 * Конфигурация записи в отдельный счётчик; токен не выводится через toString.
 * @property counterId положительный номер счётчика.
 * @property token токен записи выбранного канала, извлекаемый из дистрибутива.
 * @property baseUrl контролируемый технический HTTPS-адрес без параметров и credentials.
 * @property operations закрытый каталог допустимых операций клиента.
 */
public class MetricaConfig(
    public val counterId: String,
    public val token: String,
    public val baseUrl: String,
    operations: Set<String>,
) {
    /** Снимок каталога; нормализованные имена должны быть уникальны. */
    public val operations: Set<String> = operations.toSet()

    init {
        require(counterId.toLongOrNull()?.let { it > 0 } == true) { "Invalid analytics counter" }
        require(token.isNotBlank()) { "Missing analytics token" }
        val url = Url(baseUrl)
        require(
            url.protocol == URLProtocol.HTTPS && url.host.isNotBlank() && url.user.isNullOrEmpty() &&
                url.password.isNullOrEmpty() && '?' !in baseUrl && '#' !in baseUrl,
        )

        require(operations.isNotEmpty() && operations.all { it.matches(Regex("[a-z][a-z0-9_ -]{0,79}")) })
        require(operations.map(::normalizeOperation).toSet().size == operations.size) { "Analytics goal collision" }
    }
}

private val metricaEventNames = mapOf("cli" to "cli_operation_finished", "mcp" to "mcp_tool_finished")

/**
 * Единый каталог доставки и настройки целей счётчика, без токенов и сетевых обращений.
 * Ключ — точные имя события, операция до нормализации и результат; значение — идентификатор цели.
 * @param channel канал CLI или встроенного MCP.
 * @param operations закрытый набор операций клиента.
 * @return соответствие полного ключа события идентификатору цели в порядке операций и результатов.
 */
public fun metricaGoalCatalog(
    channel: String,
    operations: Set<String>,
): Map<Triple<String, String, String>, String> {
    val eventName = metricaEventNames.getValue(channel)
    return operations.sorted().flatMap { operation ->
        listOf("success", "failure", "cancelled").map { outcome ->
            Triple(eventName, operation, outcome) to "${channel}_${normalizeOperation(operation)}_$outcome"
        }
    }.toMap()
}

internal fun normalizeOperation(operation: String): String = operation.replace(' ', '_').replace('-', '_')

/** Стабильный числовой идентификатор одной установки для всех режимов. */
public fun interface MetricaIdentityStore {
    /** Атомарно возвращает прежний или впервые сохраняет новый положительный числовой ID. */
    public suspend fun getOrCreateInstallationId(): String
}

/**
 * Граница HTTP-запроса без типов сетевой библиотеки. Содержит токен, поэтому не является data class.
 * @property fields разрешённые поля POST, включая токен; не выводить в диагностику.
 */
public class MetricaRequest(public val fields: Map<String, String>)

/** Транспорт, принадлежащий экземпляру адаптера. */
public interface MetricaTransport {
    /** Возвращает true только при успешном приёме запроса. */
    public suspend fun send(request: MetricaRequest): Boolean

    /** Освобождает принадлежащий адаптеру HTTP-клиент. */
    public fun close()
}

/** Разрешённые свойства визита, общие для операций клиента. */
internal fun AnalyticsContext.visitProperties(): Map<String, String> = mapOf(
    "client_type" to clientType,
    "client_version" to clientVersion.take(64),
    "os_family" to osFamily.take(32),
    "schema_version" to "1",
)
