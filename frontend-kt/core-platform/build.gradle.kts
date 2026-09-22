plugins {
    id("convention.kotlin-multiplatform-node-library")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            // PlatformDelegate.platforms и PlatformRunCommand публично оперируют TargetPlatform.
            api(projects.coreDomain)
            // PlatformCapabilityRunner собирается из ProjectContextReader и WorkspaceFileSystem.
            implementation(projects.coreApplication)
            // corePlatformModule(): Module — публичная фабрика, возвращающая тип Koin.
            api(libs.koin.core)
        }

        commonTest.dependencies {
            // Тест runner'а собирает ProjectContextReader и WorkspaceFileSystem напрямую.
            implementation(projects.coreApplication)
            implementation(libs.okio)
        }
    }
}
