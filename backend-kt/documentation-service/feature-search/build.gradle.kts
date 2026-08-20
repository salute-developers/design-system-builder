plugins {
    id("convention.feature-module")
    id("convention.detekt")
    id("convention.spotless")
}

dependencies {
    implementation(project(":feature-publication"))
    implementation(libs.exposed.json)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlin.test.junit)
}
