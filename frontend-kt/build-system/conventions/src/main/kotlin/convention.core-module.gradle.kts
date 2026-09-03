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

        "implementation"(exposed.core)
        "implementation"(exposed.jdbc)

        "implementation"(ktor.serialization.kotlinx.json)

        "implementation"(koin.core)
        "implementation"(koin.ktor)
        "implementation"(koin.logger.slf4j)

    }

}
