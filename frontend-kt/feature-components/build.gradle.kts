plugins {
    id("convention.kotlin-multiplatform-node-library")
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
