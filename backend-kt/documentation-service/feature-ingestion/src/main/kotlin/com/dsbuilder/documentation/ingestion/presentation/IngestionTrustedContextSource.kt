package com.dsbuilder.documentation.ingestion.presentation

import io.ktor.http.Headers
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.application
import io.ktor.server.routing.Route
import io.ktor.server.routing.application
import io.ktor.util.AttributeKey

/** Поставляет проверенный контекст конкретного публичного запроса. */
fun interface IngestionTrustedContextSource {
    /** Возвращает проверенные поля участника и технические заголовки. */
    fun headers(call: ApplicationCall): Headers
}
private val sourceKey = AttributeKey<IngestionTrustedContextSource>("Ingestion.context.source")
private val prefixKey = AttributeKey<String>("Ingestion.route.prefix")

/** Настраивает публичные маршруты без зависимости от исполняемого app. */
fun Application.configureIngestionPublicEntry(prefix: String, source: IngestionTrustedContextSource) {
    attributes.put(sourceKey, source)
    attributes.put(prefixKey, prefix)
}

/** Читает контекст из адаптера входа или заголовков сохранённой точки запуска. */
fun ApplicationCall.ingestionTrustedHeaders(): Headers =
    application.attributes.getOrNull(sourceKey)?.headers(this) ?: request.headers

/** Отображает маршрут подсистемы в публичный префикс. */
fun Route.ingestionRoutePath(path: String): String =
    application.attributes.getOrNull(prefixKey)?.let { it + path.removePrefix("/documentation") } ?: path
