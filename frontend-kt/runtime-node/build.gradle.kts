plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("convention.detekt")
    id("convention.spotless")
}

kotlin {
    js(IR) {
        nodejs()
        useCommonJs()
        binaries.library()
    }
    sourceSets {
        jsMain.dependencies {
            implementation(npm("koffi", "3.3.2"))
            api(projects.coreApplication)
            api(projects.coreAuth)
            implementation(projects.coreWorkspace)
            implementation(projects.coreProcess)
            implementation(projects.coreNetwork)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.ktor.client.js)
            implementation(libs.okio)
        }
        jsTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.kotlinx.coroutines.test)
        }
    }
}

configure<io.gitlab.arturbosch.detekt.extensions.DetektExtension> {
    source = project.files("src/jsMain/kotlin", "src/jsTest/kotlin")
}
