plugins {
    id("convention.root-project")
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.plugin.serialization)
    id("convention.detekt")
    id("convention.spotless")
}
group = "com.dsbuilder.consent"
version = "1.0.0"
dependencies {
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.server.config.yaml)
    implementation(libs.hikari)
    implementation(libs.postgresql.jdbc)
    implementation(libs.flyway.core)
    implementation(libs.flyway.database.postgresql)
    testImplementation(libs.snakeyaml)
    testImplementation(libs.testcontainers.postgresql)
    testImplementation(libs.kotlin.test.junit)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.ktor.server.content.negotiation)
}
tasks.processResources {
    eachFile { path = "dsbuilder/consent/$path" }
    includeEmptyDirs = false
}
