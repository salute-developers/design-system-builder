plugins {
    id("convention.kotlin-multiplatform-module")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            implementation(projects.coreDomain)
            implementation(projects.coreWorkspace)
            // initApplicationModule(): Module is a public factory returning a Koin type.
            api(libs.koin.core)
        }
    }
}
