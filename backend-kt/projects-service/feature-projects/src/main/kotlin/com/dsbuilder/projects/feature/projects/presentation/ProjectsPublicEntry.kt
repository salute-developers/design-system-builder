package com.dsbuilder.projects.feature.projects.presentation

import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.Route
import kotlinx.serialization.json.Json

/** Создаёт изолированную ветвь projects с прежними настройками JSON без влияния на соседние подсистемы. */
fun Route.projectsPublicEntry(): Route = createChild(ProjectsPublicEntrySelector()).apply {
    install(ContentNegotiation) {
        json(
            Json {
                ignoreUnknownKeys = true
                explicitNulls = false
            },
        )
    }
}
