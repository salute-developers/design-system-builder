import com.sdds.plugin.themebuilder.OutputLocation
import com.sdds.plugin.themebuilder.ThemeBuilderMode
import org.gradle.kotlin.dsl.version


plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.multiplatform")
    id("org.jetbrains.compose")
    id("io.github.salute-developers.design-system-builder") version "0.48.0"
}

group = "com.dsbuilder.playground"
version = "0.1.0-SNAPSHOT"

kotlin {
    explicitApi()

    androidTarget {
        compilations.all {
            compileTaskProvider.configure {
                compilerOptions {
                    jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
                }
            }
        }
    }

    jvm()

    js(IR) {
        browser()
        nodejs()
        binaries.executable()
    }

    wasmJs {
        browser()
        binaries.executable()
    }

    iosArm64()
    iosSimulatorArm64()
    iosX64()

    macosArm64()
    macosX64()

    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation("io.github.salute-developers:sdds-uikit-compose:0.51.0")
            implementation("io.github.salute-developers:sdds-icons-compose:0.51.0")
            implementation("io.github.salute-developers:sdds-uikit-compose-fixtures:0.35.1")
        }

        commonTest.dependencies {
            implementation(kotlin("test"))
        }

        val nonAndroidMain by creating {
            dependsOn(commonMain.get())
        }

        val jvmMain by getting {
            dependsOn(nonAndroidMain)
        }

        val jsMain by getting {
            dependsOn(nonAndroidMain)
        }

        val wasmJsMain by getting {
            dependsOn(nonAndroidMain)
        }

        val appleMain by creating {
            dependsOn(nonAndroidMain)
        }

        val iosMain by creating {
            dependsOn(appleMain)
        }

        iosArm64Main.get().dependsOn(iosMain)
        iosSimulatorArm64Main.get().dependsOn(iosMain)
        iosX64Main.get().dependsOn(iosMain)

        macosArm64Main.get().dependsOn(appleMain)
        macosX64Main.get().dependsOn(appleMain)
    }
}

android {
    namespace = "com.dsbuilder.playground.sdds.compose"
    compileSdk = 35

    defaultConfig {
        minSdk = 23
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dsBuilder {
    autoGenerate.set(false)
    targets {
        compose(multiplatform = true)
    }
    outputLocation.set(OutputLocation.BUILD)
    packageName.set("com.dsbuilder.playground.sdds.compose")
    theme {
        mode.set(ThemeBuilderMode.THEME)
    }
    components {
        source("file:///Users/alex/Projects/Plasma/design-system-builder/playground/sdds-ds-compose/.sdds/components/components.zip")
        componentsMetaStyleClass.set(true)
    }

    documentation {  }
}

dependencies {
    "sddsCoreDocumentation"("io.github.salute-developers:sdds-uikit-compose-fixtures:0.35.1:docs@jar")
}

val sddsDirectory = layout.projectDirectory.dir(".sdds")
