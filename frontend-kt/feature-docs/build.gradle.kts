plugins {
    id("convention.kotlin-multiplatform-module")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            implementation(projects.coreDomain)
            implementation(projects.corePlatform)
            implementation(projects.coreNetwork)
            implementation(projects.coreWorkspace)
            implementation(projects.coreApplication)
            // docsApplicationModule(): Module is a public factory returning a Koin type.
            api(libs.koin.core)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.okio)
        }
    }
}
