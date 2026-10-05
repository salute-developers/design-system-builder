plugins {
    application
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.ktor)
    alias(libs.plugins.kotlin.plugin.serialization)
    id("convention.detekt")
    id("convention.spotless")
}

application {
    mainClass = "com.dsbuilder.ds.app.ApplicationKt"
}

tasks.shadowJar {
    duplicatesStrategy = DuplicatesStrategy.INCLUDE
    mergeServiceFiles()
}

val generatedMigrationDirectory = layout.buildDirectory.dir("generated/flyway")
val drizzleMigrations = fileTree("../../../js/services/db-service/drizzle") {
    include("000*.sql")
}.files.sortedBy { it.name }

val generateFlywayBaseline by tasks.registering {
    inputs.files(drizzleMigrations)
    outputs.dir(generatedMigrationDirectory)
    doLast {
        val target = generatedMigrationDirectory.get().file("db/migration/V1__db_service_baseline.sql").asFile
        target.parentFile.mkdirs()
        target.writeText(
            drizzleMigrations.joinToString("\n\n") { migration ->
                "-- Source: ${migration.name}\n${migration.readText()}"
            },
        )
    }
}

sourceSets.main {
    resources.srcDir(generatedMigrationDirectory)
}

tasks.processResources {
    dependsOn(generateFlywayBaseline)
    from("../contracts") {
        into("contracts")
    }
    from("../../../js/apps/admin/src/api/openapi.json") {
        into("contracts")
        rename { "db-service-openapi.json" }
    }
}

dependencies {
    implementation("com.dsbuilder.authorization:authorization-core")
    implementation(project(":core"))
    implementation(project(":feature-design-systems"))
    implementation(project(":feature-themes"))
    implementation(project(":feature-tokens"))
    implementation(project(":feature-components"))
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.netty)
    implementation(libs.ktor.server.call.logging)
    implementation(libs.ktor.server.call.id)
    implementation(libs.ktor.server.status.pages)
    implementation(libs.ktor.server.double.receive)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.server.config.yaml)
    implementation(libs.koin.ktor)
    implementation(libs.koin.logger.slf4j)
    implementation(libs.logback.classic)
    implementation(libs.exposed.jdbc)
    implementation(libs.postgresql.jdbc)
    implementation(libs.flyway.core)
    implementation(libs.flyway.database.postgresql)

    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlin.test.junit)
    testImplementation(libs.testcontainers.postgresql)
}
