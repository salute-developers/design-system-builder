package com.dsbuilder.app.presentation

import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.path

/** Повторное чтение нужно только валидаторам JSON предметных DS-маршрутов. */
fun cacheDsJsonBody(call: ApplicationCall): Boolean {
    val path = call.request.path()
    return Regex("^/api/projects/[^/]+/ds(?:/.*)?$").matches(path) || path.startsWith("/api/admin/")
}
