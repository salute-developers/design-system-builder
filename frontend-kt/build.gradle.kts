plugins {
    id("convention.root-project")
    id("convention.detekt")
    id("convention.spotless")
}

tasks.register("test") {
    val testTasks = subprojects.flatMap {
        it.tasks.matching { task -> task.name == "allTests" || task.name == "test" }
    }
    dependsOn(testTasks)
}

val sharedNodeCompatibleModules = listOf(
    "core-domain",
    "core-auth",
    "core-network",
    "core-workspace",
    "core-application",
    "feature-auth",
    "feature-status",
    "mcp-server-core",
)

tasks.register("compileSharedMcpDependencyGraph") {
    group = "verification"
    description = "Compiles shared MCP dependency graph for JVM, Node.js JS, macOS arm64 and macOS x64."

    sharedNodeCompatibleModules.forEach { moduleName ->
        dependsOn(
            ":$moduleName:compileKotlinJvm",
            ":$moduleName:compileKotlinJs",
            ":$moduleName:compileKotlinMacosArm64",
            ":$moduleName:compileKotlinMacosX64",
        )
    }
}

tasks.named("check") {
    dependsOn("compileSharedMcpDependencyGraph")
}

tasks.register("verifyFast") {
    group = "verification"
    description = "Runs frontend architecture, formatting, static analysis, and tests."
    dependsOn(":architecture-tests:test")
    dependsOn("detektAll", "spotlessCheckAll", "test")
}

tasks.register("verifyFull") {
    group = "verification"
    description = "Runs FAST verification and builds every frontend module."
    dependsOn("verifyFast")
    dependsOn("build")
    dependsOn(subprojects.map { "${it.path}:build" })
}
