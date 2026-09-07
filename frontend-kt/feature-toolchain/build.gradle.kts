plugins {
    id("convention.kotlin-multiplatform-module")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            // Результаты команд публично оперируют ToolchainId, Capability, ToolchainStatus и WorkspacePaths.
            api(projects.corePlatform)
            api(projects.coreDomain)
            implementation(projects.coreApplication)
            // toolchainApplicationModule(): Module — публичная фабрика, возвращающая тип Koin.
            api(libs.koin.core)
        }

        commonTest.dependencies {
            implementation(projects.coreApplication)
            implementation(libs.okio)
        }
    }
}
