plugins {
    id("convention.kotlin-multiplatform-module")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            // GenerateComponentsCommand.platform публично оперирует TargetPlatform.
            api(projects.coreDomain)
            // GenerateComponentsUseCase публично возвращает PlatformRunResult.
            api(projects.corePlatform)
            // FetchSource/PushTarget expose ResolvedApiUrl (core-network) as a public property.
            api(projects.coreNetwork)
            implementation(projects.coreWorkspace)
            implementation(projects.coreApplication)
            // componentsApplicationModule(): Module is a public factory returning a Koin type.
            api(libs.koin.core)
            implementation(libs.kotlinx.serialization.json)
        }

        commonTest.dependencies {
            implementation(projects.coreAuth)
            implementation(libs.ktor.client.mock)
        }
    }
}
