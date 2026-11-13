plugins {
    `java-library`
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.plugin.serialization)
    id("convention.detekt")
    id("convention.spotless")
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
    implementation(libs.snakeyaml)
    implementation(libs.koin.ktor)
    implementation(libs.aws.s3)
    implementation(libs.aws.url.connection.client)
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

tasks.processResources {
    eachFile { path = "dsbuilder/ds/$path" }
    includeEmptyDirs = false
    from("../contracts") { into("contracts") }
}

dependencies { implementation("com.dsbuilder.runtime:runtime-contracts") }

// Отдельная компиляция стенда; обычные тесты не зависят от его классов и CIO.
val performance by sourceSets.creating
configurations[performance.implementationConfigurationName].extendsFrom(configurations.testImplementation.get())
configurations[performance.runtimeOnlyConfigurationName].extendsFrom(configurations.testRuntimeOnly.get())
performance.compileClasspath += sourceSets.test.get().output
performance.runtimeClasspath += sourceSets.test.get().output
kotlin.target.compilations.getByName("performance").associateWith(kotlin.target.compilations.getByName("test"))
dependencies { add(performance.implementationConfigurationName, libs.ktor.client.cio) }
tasks.register<Test>("queryPerformance") {
    description = "Сравнивает HTTP-чтения на репрезентативной изолированной PostgreSQL 17."
    group = "verification"
    testClassesDirs = performance.output.classesDirs
    classpath = performance.runtimeClasspath
    include("**/ThemeQueryPerformanceTest.class")
    environment("DS_QUERY_PERFORMANCE_STATS", "true")
    systemProperty("ds.performance.output", providers.gradleProperty("performanceOutput")
        .getOrElse(layout.buildDirectory.file("query-performance/report.json").get().asFile.absolutePath))
    systemProperty("ds.performance.fixtureImport", providers.gradleProperty("performanceFixtureImport").getOrElse(""))
    systemProperty("ds.performance.fixtureExport", providers.gradleProperty("performanceFixtureExport").getOrElse(""))
    systemProperty("ds.performance.legacy", providers.gradleProperty("performanceLegacy").getOrElse("false"))
    systemProperty("ds.performance.readMode", providers.gradleProperty("performanceReadMode").getOrElse("addressed"))
    systemProperty("ds.performance.scenario", providers.gradleProperty("performanceScenario").getOrElse(""))
    systemProperty("ds.performance.jfr", providers.gradleProperty("performanceJfr").getOrElse(""))
    systemProperty("ds.performance.editDensity", providers.gradleProperty("performanceEditDensity").getOrElse(""))
    systemProperty("ds.performance.netty", providers.gradleProperty("performanceNetty").getOrElse("false"))
    systemProperty("kotlinx.coroutines.debug", "off")
    outputs.upToDateWhen { false }
}
