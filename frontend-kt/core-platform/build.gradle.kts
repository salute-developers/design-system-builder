plugins {
    id("convention.kotlin-multiplatform-node-library")
}

kotlin {
    macosArm64()
    macosX64()
    mingwX64()

    sourceSets {
        commonMain.dependencies {
            // PlatformDelegate.platforms и PlatformRunCommand публично оперируют TargetPlatform.
            api(projects.coreDomain)
            implementation(projects.coreProcess)
            // PlatformCapabilityRunner собирается из ProjectContextReader и WorkspaceFileSystem.
            implementation(projects.coreApplication)
            // corePlatformModule(): Module — публичная фабрика, возвращающая тип Koin.
            api(libs.koin.core)
        }

        commonTest.dependencies {
            implementation(libs.kotlinx.coroutines.test)
            // Тест runner'а собирает ProjectContextReader и WorkspaceFileSystem напрямую.
            implementation(projects.coreApplication)
            implementation(libs.okio)
        }
    }
}
