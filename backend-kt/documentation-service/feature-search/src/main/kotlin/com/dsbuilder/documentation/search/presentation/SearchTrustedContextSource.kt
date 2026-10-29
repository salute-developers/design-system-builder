package com.dsbuilder.documentation.search.presentation

import io.ktor.http.Headers
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.application
import io.ktor.server.routing.Route
import io.ktor.server.routing.application
import io.ktor.util.AttributeKey

/** Поставляет проверенный контекст конкретного публичного запроса. */
fun interface SearchTrustedContextSource {
    /** Возвращает проверенные поля участника и технические заголовки. */
    fun headers(call: ApplicationCall): Headers
}
private val sourceKey = AttributeKey<SearchTrustedContextSource>("Search.context.source")
private val prefixKey = AttributeKey<String>("Search.route.prefix")

/** Настраивает публичные маршруты без зависимости от исполняемого app. */
fun Application.configureSearchPublicEntry(prefix: String, source: SearchTrustedContextSource) {
    attributes.put(sourceKey, source)
    attributes.put(prefixKey, prefix)
}

/** Читает контекст из адаптера входа или заголовков сохранённой точки запуска. */
fun ApplicationCall.searchTrustedHeaders(): Headers =
    application.attributes.getOrNull(sourceKey)?.headers(this) ?: request.headers

/** Отображает маршрут подсистемы в публичный префикс. */
fun Route.searchRoutePath(path: String): String =
    application.attributes.getOrNull(prefixKey)?.let { it + path.removePrefix("/documentation") } ?: path
