plugins {
    id("convention.kotlin-multiplatform-module")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            // GenerateDesignSystemCommand.platform публично оперирует TargetPlatform.
            api(projects.coreDomain)
            // GenerateDesignSystemUseCase публично возвращает PlatformRunResult и принимает PlatformRunPlan.
            api(projects.corePlatform)
            // dsApplicationModule(): Module — публичная фабрика, возвращающая тип Koin.
            api(libs.koin.core)
        }
    }
}
