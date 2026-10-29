@file:Suppress("DSL_SCOPE_VIOLATION", "UnstableApiUsage")

plugins {
    id("convention.root-project")
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.ktor) apply false
    alias(libs.plugins.kotlin.plugin.serialization) apply false
}

buildscript {
    repositories {
        google()
        mavenCentral()
        maven {
            url = uri("https://plugins.gradle.org/m2/")
        }
    }

    dependencies {
        classpath(libs.gradle.kotlin)
        classpath(libs.gradle.detekt)
        classpath(libs.gradle.spotless)
    }
}

allprojects { group = "com.dsbuilder.identity"; version = "1.0.0" }

allprojects {
    tasks.withType<org.gradle.jvm.tasks.Jar>().configureEach {
        archiveBaseName.set("${rootProject.name}-${project.name}")
    }
    plugins.withId("org.jetbrains.kotlin.jvm") {
        extensions.configure<org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension> {
            compilerOptions.moduleName.set("${project.group}.${project.name}")
        }
    }
}
