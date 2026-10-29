plugins {
    id("convention.kotlin-multiplatform-node-library")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            api(projects.coreAuth)
            api(projects.coreNetwork)
            // OAuth use case'ы публично принимают CoroutineDispatcher.
            api(libs.kotlinx.coroutines.core)
            api(libs.koin.core)
        }

        commonTest.dependencies {
            implementation(libs.kotlinx.coroutines.test)
        }
    }
}
