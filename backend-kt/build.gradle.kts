plugins {
    id("convention.root-project")
}

val productBuilds = gradle.includedBuilds.filter { it.name != "build-system" }

tasks.register("verifyFast") {
    group = "verification"
    description = "Runs backend architecture, formatting, static analysis, and tests."
    dependsOn(":architecture-tests:test")
    dependsOn("detektAll", "spotlessCheckAll")
    dependsOn(productBuilds.map { it.task(":testAll") })
}

tasks.register("verifyFull") {
    group = "verification"
    description = "Runs FAST verification and builds every backend product."
    dependsOn("verifyFast")
    dependsOn(productBuilds.map { it.task(":buildAll") })
}
