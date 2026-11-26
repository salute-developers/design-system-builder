plugins {
    id("convention.kotlin-multiplatform-node-library")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    macosArm64()
    macosX64()
    mingwX64()

    sourceSets {
        jsMain.dependencies { implementation(npm("fflate", "0.8.2")) }
        commonMain.dependencies {
            // GenerateComponentsCommand.platform публично оперирует TargetPlatform.
            api(projects.coreDomain)
            // GenerateComponentsUseCase публично возвращает PlatformRunResult.
            api(projects.corePlatform)
            // FetchSource/PushTarget expose ResolvedApiUrl (core-network) as a public property.
            api(projects.coreNetwork)
            implementation(projects.coreWorkspace)
            api(projects.coreApplication)
            // componentsApplicationModule(): Module is a public factory returning a Koin type.
            api(libs.koin.core)
            api(libs.kotlinx.serialization.json)
            implementation(libs.okio)
        }

        commonTest.dependencies {
            implementation(projects.coreAuth)
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.ktor.client.mock)
        }

        val nativeMain by creating {
            dependsOn(commonMain.get())
        }

        getByName("macosArm64Main").dependsOn(nativeMain)
        getByName("macosX64Main").dependsOn(nativeMain)
        getByName("mingwX64Main").dependsOn(nativeMain)
    }
}
