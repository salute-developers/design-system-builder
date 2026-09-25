plugins {
    id("org.gradle.kotlin.kotlin-dsl")
}

dependencies {
    implementation(libs.kotlin.stdlib)
    implementation(libs.gradle.kotlin)
    implementation(libs.gradle.detekt)
    implementation(libs.gradle.spotless)
    implementation(libs.gradle.kotlinSerialization)
    implementation(libs.gradle.intellijPlatform)
    implementation(libs.gradle.kotlinComposeCompiler)

    implementation(files(libs.javaClass.superclass.protectionDomain.codeSource.location))
}
