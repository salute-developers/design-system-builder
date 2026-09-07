rootProject.name = "design-system-builder-frontend"
enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

pluginManagement {
    includeBuild("build-system")

    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

includeBuild("build-system")

include(":core-domain")
include(":core-network")
include(":core-auth")
include(":core-workspace")
include(":core-application")
include(":feature-init")
include(":feature-status")
include(":feature-theme")
include(":feature-docs")
include(":feature-components")
include(":cli")
