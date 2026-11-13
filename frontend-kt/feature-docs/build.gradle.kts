plugins {
    id("convention.kotlin-multiplatform-node-library")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    macosArm64()
    macosX64()
    mingwX64()

    sourceSets {
        commonMain.dependencies {
            implementation(projects.coreDomain)
            implementation(projects.corePlatform)
            implementation(projects.coreNetwork)
            implementation(projects.coreWorkspace)
            implementation(projects.coreApplication)
            // docsApplicationModule(): Module is a public factory returning a Koin type.
            api(libs.koin.core)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.okio)
        }

        commonTest.dependencies {
            implementation(libs.kotlinx.coroutines.test)
        }

        val posixMain by creating {
            dependsOn(commonMain.get())
        }

        jvmMain {
            dependsOn(posixMain)
        }

        val nativeMain by creating {
            dependsOn(posixMain)
        }

        getByName("macosArm64Main").dependsOn(nativeMain)
        getByName("macosX64Main").dependsOn(nativeMain)
        getByName("mingwX64Main").dependsOn(nativeMain)
    }
}

tasks.matching {
    it.name == "jsTest" ||
        it.name == "jsNodeTest" ||
        it.name == "compileTestKotlinJs" ||
        it.name == "compileTestDevelopmentExecutableKotlinJs" ||
        it.name == "jsTestTestDevelopmentExecutableCompileSync"
}.configureEach {
    enabled = false
}
