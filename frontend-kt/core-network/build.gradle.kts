plugins {
    id("convention.kotlin-multiplatform-node-library")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            // ApiUrlResolver's public constructor takes EnvironmentReader, and
            // KtorAuthenticatedHttpClientFactory's public constructor takes a `() -> HttpClient`:
            // both cross this module's public API, so consumers need them transitively.
            api(projects.coreAuth)
            api(libs.ktor.client.core)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.serialization.json)
        }

        commonTest.dependencies {
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.ktor.client.mock)
        }
    }
}
