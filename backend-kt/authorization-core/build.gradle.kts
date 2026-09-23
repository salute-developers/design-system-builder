plugins {
    id("convention.root-project")
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.plugin.serialization)
    id("convention.detekt")
    id("convention.spotless")
}

group = "com.dsbuilder.authorization"
version = "1.0.0"

dependencies {
    implementation(libs.kotlinx.serialization.json)
    testImplementation(libs.kotlin.test.junit)
}

tasks.processResources {
    from("../../authorization") { into("authorization") }
}

tasks.processTestResources {
    from("../../authorization") { into("authorization") }
}
