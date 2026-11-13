package com.dsbuilder.projects.feature.projects.presentation

import io.ktor.http.Headers
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.application
import io.ktor.server.routing.Route
import io.ktor.server.routing.application
import io.ktor.util.AttributeKey

/** Поставляет проверенный контекст конкретного публичного запроса. */
fun interface ProjectsTrustedContextSource {
    /** Возвращает проверенные поля участника и технические заголовки. */
    fun headers(call: ApplicationCall): Headers
}
private val sourceKey = AttributeKey<ProjectsTrustedContextSource>("Projects.context.source")
private val prefixKey = AttributeKey<String>("Projects.route.prefix")

/** Настраивает публичные маршруты без зависимости от исполняемого app. */
fun Application.configureProjectsPublicEntry(prefix: String, source: ProjectsTrustedContextSource) {
    attributes.put(sourceKey, source)
    attributes.put(prefixKey, prefix)
}

/** Читает контекст из адаптера входа или заголовков сохранённой точки запуска. */
fun ApplicationCall.projectsTrustedHeaders(): Headers =
    application.attributes.getOrNull(sourceKey)?.headers(this) ?: request.headers

/** Отображает маршрут подсистемы в публичный префикс. */
fun Route.projectsRoutePath(path: String): String =
    application.attributes.getOrNull(prefixKey)?.let { it + path.removePrefix("/projects") } ?: path
