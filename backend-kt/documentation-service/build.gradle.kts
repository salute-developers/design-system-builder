@file:Suppress("DSL_SCOPE_VIOLATION", "UnstableApiUsage")

plugins {
    id("convention.root-project")
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.ktor) apply false
    alias(libs.plugins.kotlin.plugin.serialization) apply false
}

buildscript {
    repositories { mavenCentral(); gradlePluginPortal() }
    dependencies {
        classpath(libs.gradle.kotlin)
        classpath(libs.gradle.detekt)
        classpath(libs.gradle.spotless)
    }
}
