plugins {
    id("convention.kotlin-multiplatform-node-library")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            implementation(libs.kotlinx.serialization.json)
        }

        commonTest.dependencies {
            implementation(libs.kotlinx.coroutines.test)
        }
    }
}
