plugins {
    id("convention.kotlin-multiplatform-node-library")
}

kotlin {
    macosArm64()
    macosX64()
    mingwX64()

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
            implementation(libs.kotlinx.coroutines.test)
            implementation(projects.coreWorkspace)
            implementation(libs.okio)
        }
    }
}
