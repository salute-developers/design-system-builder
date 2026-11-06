plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("convention.detekt")
    id("convention.spotless")
}

kotlin {
    js(IR) {
        // Окно плагина — браузер; тесты идут в Node, браузер для них не нужен.
        browser {
            testTask { enabled = false }
        }
        nodejs()
        binaries.executable()
        useEsModules()
        generateTypeScriptDefinitions()
        outputModuleName.set("dsbuilder-core")
        compilerOptions {
            target.set("es2015")
        }
    }

    sourceSets {
        jsMain.dependencies {
            implementation(projects.coreAuth)
            implementation(projects.coreNetwork)
            implementation(projects.featureAuth)
            implementation(projects.featureDs)
            implementation(projects.featureProjects)
            implementation(projects.featureTheme)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.js)
        }

        jsTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.ktor.client.mock)
        }
    }
}

tasks.register<Sync>("syncFigmaPluginCore") {
    group = "distribution"
    description = "Copies the compiled core into the Figma plugin sources."
    dependsOn("jsProductionExecutableCompileSync")
    from(layout.buildDirectory.dir("compileSync/js/main/productionExecutable/kotlin")) {
        include("*.mjs", "*.mjs.map", "*.d.mts")
    }
    into(rootDir.resolve("../js/apps/figma-plugin/src/ui/core/generated"))
}
