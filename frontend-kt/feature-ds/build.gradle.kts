plugins {
    id("convention.kotlin-multiplatform-node-library")
}

kotlin {
    macosArm64()
    macosX64()
    mingwX64()

    sourceSets {
        commonMain.dependencies {
            api(projects.coreApplication)
            implementation(projects.coreNetwork)
            api(libs.kotlinx.serialization.json)
            // GenerateDesignSystemCommand.platform публично оперирует TargetPlatform.
            api(projects.coreDomain)
            // GenerateDesignSystemUseCase публично возвращает PlatformRunResult и принимает PlatformRunPlan.
            api(projects.corePlatform)
            // dsApplicationModule(): Module — публичная фабрика, возвращающая тип Koin.
            api(libs.koin.core)
        }
        commonTest.dependencies {
            implementation(libs.kotlinx.coroutines.test)
        }
    }
}
