plugins {
    id("convention.intellij-platform-module")
    id("org.jetbrains.kotlin.plugin.serialization")
}

private val composeMultiplatformVersion = libs.versions.compose.multiplatform.get()

// `ui-desktop` зависит от skiko API (`skiko-awt`) транзитивно, но не от платформенного
// native-рантайма — обычно его добавляет `compose.desktop.currentOs` из Gradle-плагина
// `org.jetbrains.compose`, который мы здесь не подключаем (конфликтует с IntelliJ Platform
// Gradle Plugin при апдейте, см. design.md). Без явного добавления рантайма ComposePanel падает
// в runtime с `LibraryLoadException: Cannot find libskiko-<os>.dylib.sha256`. Версия должна
// совпадать с той, что тянет `ui-desktop:$composeMultiplatformVersion` (проверено через POM).
private val skikoVersion = "0.9.4.2"

dependencies {
    implementation(projects.coreDomain)
    implementation(projects.coreNetwork)
    implementation(projects.coreAuth)
    implementation(projects.coreApplication)
    implementation(projects.featureProjects)
    implementation(projects.featureTheme)
    implementation(projects.featureAuth)
    implementation("io.github.salute-developers:sdds-serv-compose:0.43.0")
    implementation("io.github.salute-developers:sdds-uikit-compose:0.51.0")
    implementation("io.github.salute-developers:sdds-icons-compose:0.5.0")
    implementation(libs.kotlinx.coroutines.core)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-swing:${libs.versions.kotlinx.coroutines.get()}")
    implementation(libs.ktor.client.cio)
    implementation(libs.kotlinx.serialization.json)
    implementation("org.jetbrains.compose.runtime:runtime-desktop:$composeMultiplatformVersion")
    implementation("org.jetbrains.compose.foundation:foundation-desktop:$composeMultiplatformVersion")
    implementation("org.jetbrains.compose.material:material-desktop:$composeMultiplatformVersion")
    implementation("org.jetbrains.compose.ui:ui-desktop:$composeMultiplatformVersion")
    runtimeOnly("org.jetbrains.skiko:skiko-awt-runtime-macos-arm64:$skikoVersion")
    runtimeOnly("org.jetbrains.skiko:skiko-awt-runtime-macos-x64:$skikoVersion")
    runtimeOnly("org.jetbrains.skiko:skiko-awt-runtime-windows-x64:$skikoVersion")
    runtimeOnly("org.jetbrains.skiko:skiko-awt-runtime-linux-x64:$skikoVersion")

    testImplementation(libs.ktor.client.mock)

    intellijPlatform {
        androidStudio("2024.3.2.15")
    }
}

intellijPlatform {
    pluginConfiguration {
        name = "DS Builder"
        ideaVersion {
            sinceBuild = "243"
            untilBuild = "243.*"
        }
    }
}
