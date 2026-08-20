plugins {
    application
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.ktor)
    alias(libs.plugins.kotlin.plugin.serialization)
    id("convention.detekt")
    id("convention.spotless")
}

application {
    mainClass = "io.ktor.server.netty.EngineMain"
}

dependencies {
    implementation(project(":core"))
    implementation(project(":feature-projects"))

    implementation(libs.exposed.core)
    implementation(libs.exposed.jdbc)
    implementation(libs.exposed.java.time)

    implementation(libs.koin.ktor)
    implementation(libs.koin.logger.slf4j)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.server.call.logging)
    implementation(libs.ktor.server.config.yaml)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.server.default.headers)
    implementation(libs.ktor.server.netty)
    implementation(libs.ktor.server.swagger)
    implementation(libs.logback.classic)

    testImplementation(libs.kotlin.test.junit)
    testImplementation(libs.ktor.server.test.host)
}
