plugins {
    id("convention.kotlin-multiplatform-node-library")
}

kotlin {
    macosArm64()
    macosX64()
    mingwX64()

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
            implementation(libs.kotlinx.coroutines.test)
            implementation(projects.coreApplication)
            implementation(libs.okio)
        }
    }
}
