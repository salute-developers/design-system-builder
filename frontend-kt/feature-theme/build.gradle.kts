plugins {
    id("convention.kotlin-multiplatform-node-library")
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
            // ListDesignSystemTenantsUseCase публично принимает ApiUrlResolver и AuthenticatedHttpClientFactory,
            // UserSessionCredentialResolver приходит через api(core-network) -> api(core-auth).
            api(projects.coreNetwork)
            // ThemeAliasListResult.Listed exposes ProjectConfigTenant (core-workspace) publicly.
            api(projects.coreWorkspace)
            implementation(projects.coreApplication)
            // themeApplicationModule(): Module is a public factory returning a Koin type.
            api(libs.koin.core)
            implementation(libs.kotlinx.serialization.json)
        }

        commonTest.dependencies {
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.ktor.client.mock)
        }
    }
}

tasks.matching {
    it.name == "jsTest" ||
        it.name == "jsNodeTest" ||
        it.name == "compileTestKotlinJs" ||
        it.name == "compileTestDevelopmentExecutableKotlinJs" ||
        it.name == "jsTestTestDevelopmentExecutableCompileSync"
}.configureEach {
    enabled = false
}
