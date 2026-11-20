pluginManagement {
    repositories { mavenCentral(); gradlePluginPortal() }
}

dependencyResolutionManagement {
    versionCatalogs { create("libs") { from(files("../gradle/libs.versions.toml")) } }
}

rootProject.name = "ai-assistant"
includeBuild("../build-system")
includeBuild("../authorization-core")
includeBuild("../runtime-contracts")
include(":feature-chat", ":runtime")
