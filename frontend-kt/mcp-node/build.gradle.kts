@file:Suppress("UnstableApiUsage", "DSL_SCOPE_VIOLATION")

import java.nio.file.Files
import java.util.concurrent.TimeUnit

plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("convention.detekt")
    id("convention.spotless")
}

kotlin {
    js(IR) {
        nodejs()
        binaries.executable()
        useCommonJs()
    }

    sourceSets {
        commonMain.dependencies {
            implementation(projects.coreApplication)
            implementation(projects.coreAuth)
            implementation(projects.coreNetwork)
            implementation(projects.coreWorkspace)
            implementation(projects.featureAuth)
            implementation(projects.featureComponents)
            implementation(projects.featureDocs)
            implementation(projects.featureStatus)
            implementation(projects.featureTheme)
            implementation(projects.mcpServerCore)
            implementation(libs.koin.core)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.js)
            implementation(libs.okio)
        }
    }
}

val npmPackageDir = layout.buildDirectory.dir("npm-package")
val productionKotlinDir = layout.buildDirectory.dir("compileSync/js/main/productionExecutable/kotlin")

tasks.register<Sync>("packageMcpNodeNpm") {
    group = "distribution"
    description = "Assembles the dsbuilder-mcp npm package."

    dependsOn("jsProductionExecutableCompileSync")

    into(npmPackageDir)

    from(productionKotlinDir) {
        into("dist/kotlin")
    }
    from(layout.projectDirectory.file("README.md"))
    from(layout.projectDirectory.file("LICENSE"))

    doLast {
        val packageDir = npmPackageDir.get().asFile
        val binDir = packageDir.resolve("bin")
        binDir.mkdirs()
        binDir.resolve("dsbuilder-mcp.js").writeText(
            """
            #!/usr/bin/env node
            require('../dist/kotlin/design-system-builder-frontend-mcp-node.js');
            """.trimIndent() + "\n",
        )
        binDir.resolve("dsbuilder-mcp.js").setExecutable(true)
        packageDir.resolve("package.json").writeText(
            """
            {
              "name": "@dsbuilder/mcp",
              "version": "0.1.0",
              "private": true,
              "license": "UNLICENSED",
              "type": "commonjs",
              "bin": {
                "dsbuilder-mcp": "bin/dsbuilder-mcp.js"
              },
              "files": [
                "bin",
                "dist",
                "README.md",
                "LICENSE"
              ]
            }
            """.trimIndent() + "\n",
        )
    }
}

tasks.register("npmPackMcpNodeSmoke") {
    group = "verification"
    description = "Packs and installs dsbuilder-mcp in a temp directory outside the Gradle build directory."

    dependsOn("packageMcpNodeNpm")

    doLast {
        val smokeDir = Files.createTempDirectory("dsbuilder-mcp-smoke").toFile()
        val homeDir = smokeDir.resolve("home").also { it.mkdirs() }
        val packageDir = npmPackageDir.get().asFile
        fun runChecked(vararg command: String, expectedExitCode: Int = 0): String {
            val builder = ProcessBuilder(*command)
                .directory(smokeDir)
                .redirectErrorStream(true)
            builder.environment()["HOME"] = homeDir.absolutePath
            val process = builder.start()
            val output = process.inputStream.readBytes().decodeToString()
            check(process.waitFor(60, TimeUnit.SECONDS)) {
                process.destroyForcibly()
                "Command timed out: ${command.joinToString(" ")}"
            }
            check(process.exitValue() == expectedExitCode) {
                "Command failed: ${command.joinToString(" ")}\n$output"
            }
            return output
        }
        runChecked("npm", "pack", packageDir.absolutePath)
        val tarball = smokeDir.listFiles()
            ?.single { it.name.endsWith(".tgz") }
            ?: error("npm pack did not produce a tarball.")
        runChecked("npm", "install", "--no-audit", "--ignore-scripts", tarball.absolutePath)
        runChecked(smokeDir.resolve("node_modules/.bin/dsbuilder-mcp").absolutePath, "--help")
        runChecked(smokeDir.resolve("node_modules/.bin/dsbuilder-mcp").absolutePath, "auth", "--help")
        runChecked(smokeDir.resolve("node_modules/.bin/dsbuilder-mcp").absolutePath, "serve", "--help")
        val passwordOutput = runChecked(
            smokeDir.resolve("node_modules/.bin/dsbuilder-mcp").absolutePath,
            "auth",
            "login",
            "--username",
            "alice",
            "--password",
            "secret",
            expectedExitCode = 1,
        )
        check(passwordOutput.contains("password must be entered interactively")) {
            "auth login did not reject --password: $passwordOutput"
        }
        check(!passwordOutput.contains("secret")) {
            "auth login rejection leaked password argument: $passwordOutput"
        }
        val statusOutput = runChecked(
            smokeDir.resolve("node_modules/.bin/dsbuilder-mcp").absolutePath,
            "auth",
            "status",
            "--api-url",
            "http://localhost:9",
            expectedExitCode = 1,
        )
        check(statusOutput.contains("Not logged in")) {
            "auth status did not report missing session: $statusOutput"
        }
        check(!statusOutput.contains("token", ignoreCase = true)) {
            "auth status unexpectedly contained token-like text: $statusOutput"
        }
        runChecked(
            smokeDir.resolve("node_modules/.bin/dsbuilder-mcp").absolutePath,
            "auth",
            "logout",
            "--api-url",
            "http://localhost:9",
        )
        val serveBuilder = ProcessBuilder(smokeDir.resolve("node_modules/.bin/dsbuilder-mcp").absolutePath, "serve")
            .directory(smokeDir)
            .redirectErrorStream(true)
        serveBuilder.environment()["HOME"] = homeDir.absolutePath
        val serveProcess = serveBuilder.start()
        val reader = serveProcess.inputStream.bufferedReader()
        serveProcess.outputStream.bufferedWriter().use { writer ->
            writer.appendLine(
                """
                {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}
                """.trimIndent(),
            )
            writer.appendLine("""{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}""")
            writer.appendLine("""{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}""")
            writer.appendLine("""{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"missing_tool","arguments":{}}}""")
            writer.flush()

            val initializeResponse = reader.readLine() ?: error("Missing initialize response from dsbuilder-mcp serve.")
            val toolsResponse = reader.readLine() ?: error("Missing tools/list response from dsbuilder-mcp serve.")
            val unknownToolResponse = reader.readLine() ?: error("Missing unknown tool response from dsbuilder-mcp serve.")
            check(initializeResponse.contains(""""id":1""")) {
                "Initialize response did not contain id 1: $initializeResponse"
            }
            check(initializeResponse.contains(""""version":"0.1.0"""")) {
                "Initialize response did not contain server version: $initializeResponse"
            }
            check(toolsResponse.contains(""""id":2""")) {
                "tools/list response did not contain id 2: $toolsResponse"
            }
            check(toolsResponse.contains("design_system_get_context")) {
                "tools/list response did not contain design_system_get_context: $toolsResponse"
            }
            check(toolsResponse.contains("project_get_status")) {
                "tools/list response did not contain project_get_status: $toolsResponse"
            }
            check(toolsResponse.contains("tokens_list")) {
                "tools/list response did not contain tokens_list: $toolsResponse"
            }
            check(toolsResponse.contains("component_config_get")) {
                "tools/list response did not contain component_config_get: $toolsResponse"
            }
            check(!toolsResponse.contains("token_update", ignoreCase = true)) {
                "tools/list response unexpectedly contained mutating token tool: $toolsResponse"
            }
            check(!toolsResponse.contains("component_config_update", ignoreCase = true)) {
                "tools/list response unexpectedly contained mutating component tool: $toolsResponse"
            }
            check(unknownToolResponse.contains(""""id":3""")) {
                "unknown tool response did not contain id 3: $unknownToolResponse"
            }
            check(unknownToolResponse.contains(""""error"""")) {
                "unknown tool response did not contain protocol error: $unknownToolResponse"
            }
            check(!unknownToolResponse.contains(""""result"""")) {
                "unknown tool response returned tool result instead of protocol error: $unknownToolResponse"
            }
        }
        if (!serveProcess.waitFor(10, TimeUnit.SECONDS)) {
            serveProcess.destroyForcibly()
            error("dsbuilder-mcp serve did not exit after EOF stdin.")
        }
        check(serveProcess.exitValue() == 0) {
            "dsbuilder-mcp serve exited with ${serveProcess.exitValue()}: " +
                serveProcess.errorStream.readBytes().decodeToString()
        }
    }
}
