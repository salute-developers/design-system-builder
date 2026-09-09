plugins {
    id("convention.kotlin-multiplatform-module")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            // IosCliDelegate реализует PlatformDelegate — тип пересекает границу модуля.
            api(projects.corePlatform)
            implementation(projects.coreDomain)
            implementation(projects.coreProcess)
            implementation(projects.coreAuth)
            implementation(projects.coreWorkspace)
            // Ответ GitHub Releases разбирается точечно: нужны только tag и имя ассета.
            implementation(libs.kotlinx.serialization.json)
            // iosPlatformModule(): Module — публичная фабрика, возвращающая тип Koin.
            api(libs.koin.core)
        }

        commonTest.dependencies {
            implementation(projects.coreWorkspace)
            implementation(libs.okio)
        }
    }
}
