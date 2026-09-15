import org.jetbrains.intellij.platform.gradle.extensions.intellijPlatform

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
        intellijPlatform {
            defaultRepositories()
        }
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
    id("org.jetbrains.intellij.platform.settings") version "2.17.0"
}

includeBuild("build-system")

include(":core-domain")
include(":core-process")
include(":core-platform")
include(":core-network")
include(":core-auth")
include(":core-workspace")
include(":core-application")
include(":feature-init")
include(":feature-auth")
include(":feature-status")
include(":feature-theme")
include(":feature-docs")
include(":feature-components")
include(":feature-toolchain")
include(":platform-ios")
include(":mcp-server-core")
include(":mcp-node")
include(":platform-android")
include(":plugins:android-studio")
include(":cli")
