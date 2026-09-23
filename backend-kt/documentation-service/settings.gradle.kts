pluginManagement {
    repositories { mavenCentral(); gradlePluginPortal() }
}

dependencyResolutionManagement {
    versionCatalogs { create("libs") { from(files("../gradle/libs.versions.toml")) } }
}

rootProject.name = "documentation-service"
includeBuild("../build-system")
includeBuild("../authorization-core")
include(
    ":app",
    ":feature-ingestion",
    ":feature-processing",
    ":feature-publication",
    ":feature-search",
)
