package com.dsbuilder.ds.core.presentation

import io.ktor.http.Headers
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.application
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.NotFoundException
import io.ktor.server.plugins.callid.callId
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingCall
import io.ktor.server.routing.application
import io.ktor.util.AttributeKey
import java.util.UUID

/** Публичный вход поставляет уже проверенный контекст конкретного запроса. */
fun interface DsTrustedContextSource {
    /** Возвращает проверенные поля участника и технические заголовки запроса. */
    fun headers(call: ApplicationCall): Headers
}

private val contextSourceKey = AttributeKey<DsTrustedContextSource>("ds.trusted.context.source")
private val prefixPatternKey = AttributeKey<Regex>("ds.public.prefix.pattern")
private val prefixKey = AttributeKey<String>("ds.public.prefix")
internal const val DESIGN_SYSTEM_CONTEXT_HEADER = "X-DS-Expected-Design-System"

/** Настраивает отображение канонических внутренних маршрутов на публичный вход. */
fun Application.configureDsPublicEntry(prefix: String, source: DsTrustedContextSource) {
    attributes.put(prefixKey, prefix)
    val pattern = prefix.split('/').joinToString("/") { segment ->
        if (segment.startsWith('{') && segment.endsWith('}')) "[^/]+" else Regex.escape(segment)
    }
    attributes.put(prefixPatternKey, Regex("^$pattern(?=/|$)"))
    attributes.put(contextSourceKey, source)
}

/** Добавляет ожидаемую систему исключительно из пути, исключая подмену заголовком клиента. */
fun ApplicationCall.dsTrustedHeaders(): Headers {
    val owner = dsPathDesignSystemId()?.let { raw ->
        if (raw == "catalog") throw NotFoundException()
        runCatching { UUID.fromString(raw).toString() }.getOrNull()
            ?: throw BadRequestException("invalid_design_system_id")
    }
    return Headers.build {
        appendAll(application.attributes[contextSourceKey].headers(this@dsTrustedHeaders))
        this@dsTrustedHeaders.callId?.let {
            remove("X-Correlation-Id")
            append("X-Correlation-Id", it)
        }
        remove(DESIGN_SYSTEM_CONTEXT_HEADER)
        owner?.let { append(DESIGN_SYSTEM_CONTEXT_HEADER, it) }
    }
}

/** Отображает канонический путь; административные маршруты имеют самостоятельный корень. */
fun Route.dsRoutePath(path: String): String = if (path.startsWith("/api/design-systems")) {
    application.attributes[prefixKey] + path.removePrefix("/api/design-systems")
} else {
    path
}

/** Возвращает канонический внутренний адрес для поиска OpenAPI и политик. */
fun ApplicationCall.dsCanonicalPath(path: String): String {
    val matched = application.attributes[prefixPatternKey].find(path)?.value ?: return path
    return "/api/design-systems" + path.removePrefix(matched)
}

/** Настраивает самостоятельный внутренний вход за доверенной границей авторизации. */
fun configureDsServiceEntry(application: Application) {
    application.configureDsPublicEntry("/api/design-systems") { it.request.headers }
}

/** Читает владельца только из пути: query-параметры Ktor имеют приоритет в `parameters`. */
fun ApplicationCall.dsPathDesignSystemId(): String? = (this as? RoutingCall)?.pathParameters?.get("designSystemId")
