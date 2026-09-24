plugins {
    id("convention.kotlin-multiplatform-node-library")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            // ListProjectsUseCase/ProjectsClient/HttpProjectsClient публично возвращают/принимают
            // типы из core-auth (BackendCredential, UserSessionCredentialResolver) и core-network
            // (ApiUrlResolver, AuthenticatedHttpClientFactory) — оба обязаны быть `api`.
            api(projects.coreAuth)
            api(projects.coreNetwork)
            // projectsApplicationModule(): Module is a public factory returning a Koin type.
            api(libs.koin.core)
            implementation(libs.kotlinx.serialization.json)
        }

        commonTest.dependencies {
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.ktor.client.mock)
        }
    }
}
