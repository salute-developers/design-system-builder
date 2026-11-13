plugins {
    application
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.ktor)
    id("convention.detekt")
    id("convention.spotless")
}
application { mainClass = "com.dsbuilder.ds.launcher.LauncherKt" }
dependencies {
    implementation(project(":runtime"))
    implementation(libs.ktor.server.netty)
    implementation(libs.ktor.server.config.yaml)
    implementation(libs.logback.classic)
}
tasks.shadowJar { mergeServiceFiles() }
