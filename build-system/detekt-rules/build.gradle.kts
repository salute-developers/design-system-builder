plugins {
    id("org.gradle.kotlin.kotlin-dsl")
}

group = "com.nova.build.system"

dependencies {
    implementation(libs.kotlin.stdlib)
    implementation(libs.staticAnalysis.detekt.api)
    testImplementation(libs.staticAnalysis.detekt.test)
}
