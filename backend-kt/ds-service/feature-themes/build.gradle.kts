plugins {
    id("convention.feature-module")
    id("convention.detekt")
    id("convention.spotless")
}

dependencies {
    implementation("com.dsbuilder.authorization:authorization-core")
    implementation(project(":core"))
    implementation(libs.exposed.json)
    implementation(libs.postgresql.jdbc)

    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlin.test.junit)
}
