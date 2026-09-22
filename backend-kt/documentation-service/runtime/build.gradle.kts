plugins {
    id("convention.feature-module")
    id("convention.detekt")
    id("convention.spotless")
}

dependencies {
    implementation(project(":feature-ingestion"))
    implementation(project(":feature-processing"))
    implementation(project(":feature-publication"))
    implementation(project(":feature-search"))
    implementation(libs.aws.s3)
    implementation(libs.aws.url.connection.client)
    implementation(libs.exposed.jdbc)
    implementation(libs.flyway.core)
    implementation(libs.flyway.database.postgresql)
    implementation(libs.ktor.client.cio)
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.postgresql.jdbc)
    testImplementation(libs.kotlin.test.junit)
}
