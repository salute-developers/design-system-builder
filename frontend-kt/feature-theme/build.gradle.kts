plugins {
    id("convention.kotlin-multiplatform-module")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            implementation(projects.coreDomain)
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
