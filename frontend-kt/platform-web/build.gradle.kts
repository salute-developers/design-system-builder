plugins {
    id("convention.kotlin-multiplatform-module")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            // WebNpmDelegate реализует PlatformDelegate — тип пересекает границу модуля.
            api(projects.corePlatform)
            implementation(projects.coreDomain)
            implementation(projects.coreProcess)
            implementation(projects.coreAuth)
            implementation(projects.coreWorkspace)
            // webPlatformModule(): Module — публичная фабрика, возвращающая тип Koin.
            api(libs.koin.core)
        }

        commonTest.dependencies {
            implementation(projects.coreWorkspace)
            implementation(libs.okio)
        }
    }
}
