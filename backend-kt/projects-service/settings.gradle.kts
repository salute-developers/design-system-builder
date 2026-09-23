pluginManagement {
    repositories {
        google()
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

rootProject.name = "projects-service"

includeBuild("../build-system")
includeBuild("../authorization-core")
include(":app")
include(":core")
include(":feature-projects")
