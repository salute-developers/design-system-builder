plugins {
    id("convention.feature-module")
    id("convention.detekt")
    id("convention.spotless")
}

dependencies {
    implementation(project(":core"))
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.cio)
    implementation(libs.ktor.client.content.negotiation)

    testImplementation(libs.kotlin.test.junit)
    testImplementation(libs.ktor.server.test.host)
    testImplementation("io.ktor:ktor-client-mock:3.3.0")
    testImplementation("com.h2database:h2:2.2.224")
}
