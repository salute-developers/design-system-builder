plugins {
    id("convention.core-module")
    id("convention.detekt")
    id("convention.spotless")
}

dependencies {
    implementation("com.dsbuilder.authorization:authorization-core")
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.exposed.java.time)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.postgresql.jdbc)
    implementation(libs.hikari)

    testImplementation(libs.kotlin.test.junit)
}
