package com.dsbuilder.ds.core.presentation

import io.ktor.http.Headers
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.application
import io.ktor.server.routing.Route
import io.ktor.server.routing.application
import io.ktor.util.AttributeKey

/** Публичный вход поставляет уже проверенный контекст конкретного запроса. */
fun interface DsTrustedContextSource {
    /** Возвращает проверенные поля участника и технические заголовки запроса. */
    fun headers(call: ApplicationCall): Headers
}

private val contextSourceKey = AttributeKey<DsTrustedContextSource>("ds.trusted.context.source")
private val prefixPatternKey = AttributeKey<Regex>("ds.public.prefix.pattern")
private val prefixKey = AttributeKey<String>("ds.public.prefix")

/** Настраивает публичные маршруты без зависимости от исполняемого app. */
fun Application.configureDsPublicEntry(prefix: String, source: DsTrustedContextSource) {
    attributes.put(prefixKey, prefix)
    val pattern = prefix.split('/').joinToString("/") { segment ->
        if (segment.startsWith('{') && segment.endsWith('}')) "[^/]+" else Regex.escape(segment)
    }
    attributes.put(prefixPatternKey, Regex("^$pattern(?=/|$)"))
    attributes.put(contextSourceKey, source)
}

/** Получает контекст из адаптера входа или заголовков сохранённой точки запуска. */
fun ApplicationCall.dsTrustedHeaders(): Headers =
    application.attributes.getOrNull(contextSourceKey)?.headers(this) ?: request.headers

/** Отображает прежний путь на публичный префикс при регистрации маршрутов. */
fun Route.dsRoutePath(path: String): String {
    val prefix = application.attributes.getOrNull(prefixKey) ?: return path
    return if (path.startsWith("/api/ds/admin/")) {
        "/api/admin/" + path.removePrefix("/api/ds/admin/")
    } else {
        prefix + path.removePrefix("/api/ds")
    }
}

/** Находит прежний OpenAPI-путь для конкретного запроса или шаблона публичного маршрута. */
fun ApplicationCall.dsLegacyPath(path: String): String {
    val pattern = application.attributes.getOrNull(prefixPatternKey) ?: return path
    val matched = pattern.find(path)?.value
    return when {
        matched != null -> "/api/ds" + path.removePrefix(matched)
        path.startsWith("/api/admin/") -> "/api/ds/admin/" + path.removePrefix("/api/admin/")
        else -> path
    }
}
