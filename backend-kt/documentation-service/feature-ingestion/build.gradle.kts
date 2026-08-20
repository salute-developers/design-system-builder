plugins {
    id("convention.feature-module")
    id("convention.detekt")
    id("convention.spotless")
}

dependencies {
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.cio)
    implementation(libs.commons.compress)
    implementation(libs.aws.s3)
    testImplementation(libs.ktor.client.mock)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlin.test.junit)
}
