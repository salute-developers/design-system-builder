plugins {
    id("convention.kotlin-multiplatform-module")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            // InitProjectCommand.platforms публично оперирует TargetPlatform.
            api(projects.coreDomain)
            implementation(projects.coreWorkspace)
            // initApplicationModule(): Module is a public factory returning a Koin type.
            api(libs.koin.core)
        }
    }
}
