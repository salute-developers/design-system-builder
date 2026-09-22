plugins {
    id("convention.kotlin-multiplatform-node-library")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    val macosTargets = listOf(
        macosArm64(),
        macosX64(),
    )

    sourceSets {
        commonMain.dependencies {
            implementation(projects.coreApplication)
            implementation(projects.coreAuth)
            implementation(projects.coreNetwork)
            implementation(projects.featureComponents)
            implementation(projects.featureDocs)
            implementation(projects.featureStatus)
            implementation(projects.featureTheme)
            implementation(libs.kotlinx.serialization.json)
        }

        commonTest.dependencies {
            implementation(libs.kotlinx.coroutines.test)
        }

        val sdkMain by creating {
            dependsOn(commonMain.get())

            dependencies {
                implementation(libs.kotlin.sdk.server)
            }
        }

        jvmMain {
            dependsOn(sdkMain)
        }

        jsMain {
            dependsOn(sdkMain)

            dependencies {
                implementation(libs.kotlin.logging)
            }
        }

        val macosMain by creating {
            dependsOn(sdkMain)
        }

        macosTargets.forEach { target ->
            target.compilations.getByName("main").defaultSourceSet.dependsOn(macosMain)
        }
    }
}

tasks.matching {
    it.name == "jsTest" ||
        it.name == "jsNodeTest" ||
        it.name == "compileTestDevelopmentExecutableKotlinJs" ||
        it.name == "jsTestTestDevelopmentExecutableCompileSync"
}.configureEach {
    enabled = false
}
