@file:Suppress("UnstableApiUsage", "DSL_SCOPE_VIOLATION")
import utils.withVersionCatalogs
plugins {
    id("org.jetbrains.kotlin.jvm")
    id("org.jetbrains.kotlin.plugin.serialization")
}

dependencies {
    withVersionCatalogs {
        "implementation"(kotlin.stdlib)
        "implementation"(ktor.server.core)
        "implementation"(ktor.server.resources)
        "implementation"(ktor.server.compression)
        "implementation"(ktor.server.http.redirect)
        "implementation"(ktor.server.html.builder)
        "implementation"(ktor.server.content.negotiation)
        "implementation"(ktor.server.websockets)
        "implementation"(ktor.server.cors)
        "implementation"(ktor.server.host.common)
        "implementation"(ktor.server.sessions)
        "implementation"(ktor.server.auth)
        "implementation"(ktor.server.auth.jwt)
        "implementation"(ktor.server.netty)
        "implementation"(ktor.server.call.logging)

        "implementation"(exposed.core)
        "implementation"(exposed.dao)
        "implementation"(exposed.jdbc)
        "implementation"(exposed.java.time)

        "implementation"(postgresql)

        "implementation"(ktor.serialization.kotlinx.json)
        "implementation"(logback)

        "implementation"(koin.core)
        "implementation"(koin.ktor)
        "implementation"(koin.logger.slf4j)

    }

}
