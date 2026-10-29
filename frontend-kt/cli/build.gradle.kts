import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.bundling.Zip
import org.gradle.jvm.application.tasks.CreateStartScripts

plugins {
    id("convention.kotlin-multiplatform-module")
    id("org.jetbrains.kotlin.plugin.serialization")
}

kotlin {
    jvm {
        binaries {
            executable {
                mainClass.set("com.dsbuilder.frontend.cli.MainKt")
            }
        }
    }

    val macosTargets = listOf(
        macosArm64(),
        macosX64(),
    )
    val windowsTarget = mingwX64()

    macosTargets.forEach { target ->
        target.binaries {
            executable {
                baseName = "dsbuilder"
                entryPoint = "com.dsbuilder.frontend.cli.main"
            }
        }
    }

    windowsTarget.binaries {
        executable {
            baseName = "dsbuilder"
            entryPoint = "com.dsbuilder.frontend.cli.main"
        }
    }

    windowsTarget.compilations.getByName("main").cinterops.create("windowsSecurity") {
        defFile(project.file("src/nativeInterop/cinterop/windowsSecurity.def"))
    }

    sourceSets {
        commonMain.dependencies {
            implementation(projects.coreNetwork)
            implementation(projects.coreAuth)
            implementation(projects.coreWorkspace)
            implementation(projects.coreApplication)
            implementation(projects.coreDomain)
            implementation(projects.coreProcess)
            implementation(projects.corePlatform)
            implementation(projects.featureAuth)
            implementation(projects.featureInit)
            implementation(projects.featureStatus)
            implementation(projects.featureTheme)
            implementation(projects.featureDocs)
            implementation(projects.featureComponents)
            implementation(projects.featureToolchain)
            implementation(projects.featureDs)
            implementation(projects.platformIos)
            implementation(projects.mcpServerCore)
            implementation(projects.platformAndroid)
            implementation(projects.platformWeb)
            implementation(libs.clikt)
            implementation(libs.koin.core)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.okio)
            implementation(libs.ktor.client.core)
        }

        commonTest.dependencies {
            implementation(libs.ktor.client.mock)
        }

        jvmMain.dependencies {
            implementation(libs.ktor.client.cio)
        }

        val macosMain by creating {
            dependsOn(commonMain.get())

            dependencies {
                implementation(libs.ktor.client.darwin)
            }
        }

        val macosTest by creating {
            dependsOn(commonTest.get())
        }

        mingwX64Main.dependencies {
            implementation(libs.ktor.client.winhttp)
        }

        macosTargets.forEach { target ->
            target.compilations.getByName("main").defaultSourceSet.dependsOn(macosMain)
            target.compilations.getByName("test").defaultSourceSet.dependsOn(macosTest)
        }
    }
}

tasks.withType<CreateStartScripts>().configureEach {
    applicationName = "dsbuilder"
}

tasks.withType<JavaExec>().configureEach {
    if (name == "runJvm") {
        doFirst {
            mainClass.set("com.dsbuilder.frontend.cli.MainKt")
        }
    }
}

fun registerMacosCliPackage(
    taskName: String,
    classifier: String,
    targetName: String,
    linkTaskName: String,
) {
    tasks.register<Zip>(taskName) {
        group = "distribution"
        description = "Packages dsbuilder CLI for $targetName into a macOS ZIP archive."

        dependsOn(linkTaskName)

        val packageRoot = "dsbuilder-cli-macos-$classifier"

        archiveBaseName.set("dsbuilder-cli")
        archiveClassifier.set("macos-$classifier")
        destinationDirectory.set(layout.buildDirectory.dir("distributions"))

        from(layout.buildDirectory.file("bin/$targetName/releaseExecutable/dsbuilder.kexe")) {
            into(packageRoot)
            rename { "dsbuilder" }
            filePermissions {
                unix("rwxr-xr-x")
            }
        }
        from(layout.projectDirectory.file("distribution/install-macos-cli.sh")) {
            into(packageRoot)
            rename { "install.sh" }
            filePermissions {
                unix("rwxr-xr-x")
            }
        }
        from(layout.projectDirectory.file("USAGE.md")) {
            into(packageRoot)
        }
    }
}

registerMacosCliPackage(
    taskName = "packageMacosArm64Cli",
    classifier = "arm64",
    targetName = "macosArm64",
    linkTaskName = "linkReleaseExecutableMacosArm64",
)

registerMacosCliPackage(
    taskName = "packageMacosX64Cli",
    classifier = "x64",
    targetName = "macosX64",
    linkTaskName = "linkReleaseExecutableMacosX64",
)

tasks.register<Zip>("packageWindowsX64Cli") {
    group = "distribution"
    description = "Packages the native Windows x64 dsbuilder executable and user installer."

    dependsOn("linkReleaseExecutableMingwX64")
    val packageRoot = "dsbuilder-cli-windows-x64"
    archiveBaseName.set("dsbuilder-cli")
    archiveClassifier.set("windows-x64")
    destinationDirectory.set(layout.buildDirectory.dir("distributions"))

    from(layout.buildDirectory.file("bin/mingwX64/releaseExecutable/dsbuilder.exe")) {
        into(packageRoot)
    }
    from(layout.projectDirectory.file("distribution/install-windows-cli.ps1")) {
        into(packageRoot)
        rename { "install.ps1" }
    }
    from(layout.projectDirectory.file("USAGE.md")) {
        into(packageRoot)
    }
}

// JVM-дистрибутив (bin/dsbuilder + lib/*.jar) под стабильным именем для релиза CLI: CI других репозиториев
// скачивает его и запускает на Linux с Java 17.
tasks.register<Copy>("packageJvmCli") {
    group = "distribution"
    description = "Copies the JVM distribution of dsbuilder CLI under a stable name for the CLI release."

    val distribution = tasks.named<Zip>("jvmDistZip")
    dependsOn(distribution)
    from(distribution.flatMap { it.archiveFile })
    into(layout.buildDirectory.dir("distributions"))
    rename { "dsbuilder-cli-jvm.zip" }
}

tasks.register("packageMacosCli") {
    group = "distribution"
    description = "Packages dsbuilder CLI for the current macOS architecture."

    val currentArchPackageTask = when (System.getProperty("os.arch")) {
        "aarch64", "arm64" -> "packageMacosArm64Cli"
        "x86_64", "amd64" -> "packageMacosX64Cli"
        else -> "packageMacosArm64Cli"
    }

    dependsOn(currentArchPackageTask)
}
