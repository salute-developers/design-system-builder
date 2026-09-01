plugins {
    id("convention.kotlin-multiplatform-module")
}

kotlin {
    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            // ClientRuntime exposes WorkspaceFileSystem/EnvironmentReader/AuthenticatedHttpClientFactory
            // directly as public properties, and the ports/results expose core-domain types
            // (ProjectContext, ProjectApiKey, ProjectApiUrl, CredentialEnvName) — all four core-*
            // modules cross this module's public API, so consumers need them transitively.
            api(projects.coreDomain)
            api(projects.coreNetwork)
            api(projects.coreAuth)
            api(projects.coreWorkspace)
            // coreApplicationModule(): Module is a public factory returning a Koin type.
            api(libs.koin.core)
        }
    }
}
