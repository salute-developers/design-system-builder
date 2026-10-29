plugins {
    `java-library`
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.plugin.serialization)
    id("convention.detekt")
    id("convention.spotless")
}

dependencies {
    implementation("com.dsbuilder.authorization:authorization-core")
    implementation(project(":feature-ingestion"))
    implementation(project(":feature-publication"))
    implementation(project(":feature-processing"))
    implementation(project(":feature-search"))
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.netty)
    implementation(libs.ktor.server.call.logging)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.server.config.yaml)
    implementation(libs.koin.ktor)
    implementation(libs.koin.logger.slf4j)
    implementation(libs.logback.classic)
    implementation(libs.ktor.client.cio)
    implementation(libs.exposed.jdbc)
    implementation(libs.postgresql.jdbc)
    implementation(libs.aws.s3)
    implementation(libs.aws.url.connection.client)
    implementation(libs.flyway.core)
    implementation(libs.flyway.database.postgresql)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlin.test.junit)
}

tasks.processResources {
    eachFile { path = "dsbuilder/documentation/$path" }
    includeEmptyDirs = false
}

dependencies { implementation("com.dsbuilder.runtime:runtime-contracts") }

dependencies { implementation(libs.hikari) }
