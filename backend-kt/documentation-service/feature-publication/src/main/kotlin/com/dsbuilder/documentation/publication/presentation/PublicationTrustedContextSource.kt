package com.dsbuilder.documentation.publication.presentation

import io.ktor.http.Headers
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.application
import io.ktor.server.routing.Route
import io.ktor.server.routing.application
import io.ktor.util.AttributeKey

/** Поставляет проверенный контекст конкретного публичного запроса. */
fun interface PublicationTrustedContextSource {
    /** Возвращает проверенные поля участника и технические заголовки. */
    fun headers(call: ApplicationCall): Headers
}
private val sourceKey = AttributeKey<PublicationTrustedContextSource>("Publication.context.source")
private val prefixKey = AttributeKey<String>("Publication.route.prefix")

/** Настраивает публичные маршруты без зависимости от исполняемого app. */
fun Application.configurePublicationPublicEntry(prefix: String, source: PublicationTrustedContextSource) {
    attributes.put(sourceKey, source)
    attributes.put(prefixKey, prefix)
}

/** Читает контекст из адаптера входа или заголовков сохранённой точки запуска. */
fun ApplicationCall.publicationTrustedHeaders(): Headers =
    application.attributes.getOrNull(sourceKey)?.headers(this) ?: request.headers

/** Отображает маршрут подсистемы в публичный префикс. */
fun Route.publicationRoutePath(path: String): String =
    application.attributes.getOrNull(prefixKey)?.let { it + path.removePrefix("/documentation") } ?: path
