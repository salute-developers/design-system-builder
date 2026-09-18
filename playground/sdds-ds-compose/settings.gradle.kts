import org.gradle.api.initialization.resolve.RepositoriesMode

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
        mavenLocal()
    }

    plugins {
        id("com.android.library") version "8.7.3"
        id("org.jetbrains.kotlin.multiplatform") version "2.2.0"
        id("org.jetbrains.kotlin.plugin.compose") version "2.2.0"
        id("org.jetbrains.compose") version "1.8.2"
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        mavenLocal()
    }
}

rootProject.name = "sdds-ds-compose-playground"
