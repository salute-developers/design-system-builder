@file:Suppress("UnstableApiUsage", "DSL_SCOPE_VIOLATION")

import io.gitlab.arturbosch.detekt.extensions.DetektExtension
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

plugins {
    id("convention.kotlin-multiplatform-module")
}

configure<KotlinMultiplatformExtension> {
    js(IR) {
        nodejs()
        binaries.library()
    }

    sourceSets {
        val jsTest by getting
        jsTest.dependencies {
            implementation(kotlin("test-js"))
        }
    }
}

configure<DetektExtension> {
    source = project.files(
        "src/commonMain/kotlin",
        "src/commonTest/kotlin",
        "src/jvmMain/kotlin",
        "src/jvmTest/kotlin",
        "src/jsMain/kotlin",
        "src/jsTest/kotlin",
        "src/macosMain/kotlin",
        "src/macosTest/kotlin",
    )
}
