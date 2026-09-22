plugins {
    application
    id("org.jetbrains.kotlin.jvm")
    alias(libs.plugins.ktor)
    id("org.jetbrains.kotlin.plugin.serialization")
    id("convention.detekt")
    id("convention.spotless")
}

application {
    mainClass = "io.ktor.server.netty.EngineMain"
}

tasks.shadowJar {
    duplicatesStrategy = DuplicatesStrategy.INCLUDE
    mergeServiceFiles()
}

dependencies {
    implementation("com.dsbuilder.identity:feature-auth")
    implementation("com.dsbuilder.projects:core")
    implementation("com.dsbuilder.projects:feature-projects")
    implementation("com.dsbuilder.documentation:feature-ingestion")
    implementation("com.dsbuilder.documentation:feature-processing")
    implementation("com.dsbuilder.documentation:feature-publication")
    implementation("com.dsbuilder.documentation:feature-search")
    implementation("com.dsbuilder.documentation:runtime")

    implementation(libs.aws.s3)
    implementation(libs.aws.url.connection.client)
    implementation(libs.exposed.core)
    implementation(libs.exposed.jdbc)
    implementation(libs.exposed.java.time)
    implementation(libs.flyway.core)
    implementation(libs.flyway.database.postgresql)
    implementation(libs.koin.ktor)
    implementation(libs.koin.logger.slf4j)
    implementation(libs.ktor.client.cio)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.server.call.logging)
    implementation(libs.ktor.server.config.yaml)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.server.default.headers)
    implementation(libs.ktor.server.netty)
    implementation(libs.ktor.server.swagger)
    implementation(libs.logback.classic)
    implementation(libs.postgresql.jdbc)
    implementation(libs.kotlinx.coroutines.core)

    testImplementation(libs.kotlin.test.junit)
    testImplementation(libs.ktor.server.test.host)
}
