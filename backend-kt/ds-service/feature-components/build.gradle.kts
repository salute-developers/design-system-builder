plugins {
    id("convention.feature-module")
    id("convention.detekt")
    id("convention.spotless")
}

dependencies {
    implementation("com.dsbuilder.authorization:authorization-core")
    implementation(project(":core"))
    implementation(libs.exposed.json)
    implementation(libs.aws.s3)

    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.aws.url.connection.client)
    testImplementation(libs.kotlin.test.junit)
}

tasks.processResources {
    eachFile { path = "dsbuilder/ds/seeds/$path" }
    includeEmptyDirs = false
}
