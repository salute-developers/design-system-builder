plugins {
    id("convention.kotlin-multiplatform-node-library")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    macosArm64()
    macosX64()
    mingwX64()

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
            implementation(libs.okio)
        }

        commonTest.dependencies {
            implementation(projects.coreAuth)
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.ktor.client.mock)
        }

        // The archive reader of the plugin publication is native-only on macOS and JVM-only on the JVM:
        // the JS target (mcp-node) never publishes plugins.
        val nativeMain by creating {
            dependsOn(commonMain.get())
        }

        getByName("macosArm64Main").dependsOn(nativeMain)
        getByName("macosX64Main").dependsOn(nativeMain)
        getByName("mingwX64Main").dependsOn(nativeMain)
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
