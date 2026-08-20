pluginManagement {
    repositories { mavenCentral(); gradlePluginPortal() }
}

dependencyResolutionManagement {
    versionCatalogs { create("libs") { from(files("../gradle/libs.versions.toml")) } }
}

rootProject.name = "documentation-service"
includeBuild("../build-system")
include(
    ":app",
    ":feature-ingestion",
    ":feature-processing",
    ":feature-publication",
    ":feature-search",
)
