plugins {
    id("convention.kotlin-multiplatform-module")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            // GenerateThemeCommand.platform публично оперирует TargetPlatform.
            api(projects.coreDomain)
            // GenerateThemeUseCase публично возвращает PlatformRunResult и принимает PlatformRunPlan.
            api(projects.corePlatform)
            implementation(projects.coreNetwork)
            // ThemeAliasListResult.Listed exposes ProjectConfigTenant (core-workspace) publicly.
            api(projects.coreWorkspace)
            implementation(projects.coreApplication)
            // themeApplicationModule(): Module is a public factory returning a Koin type.
            api(libs.koin.core)
            implementation(libs.kotlinx.serialization.json)
        }
    }
}
