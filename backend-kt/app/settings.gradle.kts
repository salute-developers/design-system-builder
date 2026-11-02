pluginManagement { repositories { mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement {
    repositories { mavenCentral() }
    versionCatalogs { create("libs") { from(files("../gradle/libs.versions.toml")) } }
}
rootProject.name = "backend-app"
includeBuild("../build-system")

includeBuild("../identity-gateway")
includeBuild("../projects-service")
includeBuild("../ds-service")
includeBuild("../documentation-service")
includeBuild("../authorization-core")
includeBuild("../runtime-contracts")
