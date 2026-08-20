@file:Suppress("UnstableApiUsage", "DSL_SCOPE_VIOLATION")

import io.gitlab.arturbosch.detekt.extensions.DetektExtension
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("convention.detekt")
    id("convention.spotless")
}

configure<KotlinMultiplatformExtension> {
    jvm {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_1_8)
        }
    }

    sourceSets {
        commonMain.dependencies {
            implementation(kotlin("stdlib"))
        }

        commonTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}

configure<DetektExtension> {
    source = project.files(
        "src/commonMain/kotlin",
        "src/commonTest/kotlin",
        "src/jvmMain/kotlin",
        "src/jvmTest/kotlin",
    )
}
