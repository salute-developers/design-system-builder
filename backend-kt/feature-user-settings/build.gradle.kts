plugins {
    id("convention.root-project")
    id("convention.feature-module")
    id("convention.detekt")
    id("convention.spotless")
}
group = "com.dsbuilder.settings"
version = "1.0.0"
dependencies {
    implementation("com.dsbuilder.authorization:authorization-core")
    implementation(libs.ktor.client.cio)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.hikari)
    implementation(libs.flyway.core)
    implementation(libs.flyway.database.postgresql)
    testImplementation(libs.testcontainers.postgresql)
    testImplementation(libs.konsist)
    testImplementation(libs.kotlin.test.junit)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.ktor.client.mock)
    testImplementation("com.h2database:h2:2.2.224")
}

tasks.processTestResources {
    from("../projects-service/runtime/src/main/resources/pat-migrations") {
        into("dsbuilder/projects/pat-migrations")
    }
}
