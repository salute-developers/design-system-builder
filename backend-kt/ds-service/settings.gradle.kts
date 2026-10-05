pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    versionCatalogs {
        create("libs") {
            from(files("../gradle/libs.versions.toml"))
        }
    }
}

rootProject.name = "ds-service"

includeBuild("../build-system")
includeBuild("../authorization-core")

include(
    ":app",
    ":core",
    ":feature-design-systems",
    ":feature-themes",
    ":feature-tokens",
    ":feature-components",
)
