plugins {
    id("convention.root-project")
}

val productBuilds = gradle.includedBuilds.filter { it.name != "build-system" }

tasks.register("verifyFast") {
    group = "verification"
    description = "Runs backend static checks and fast JVM unit tests without external infrastructure."
    dependsOn(":architecture-tests:test")
    dependsOn("detektAll", "spotlessCheckAll")
    dependsOn("unitTestAll")
    dependsOn(productBuilds.map { it.task(":unitTestAll") })
}

tasks.register("verifyFull") {
    group = "verification"
    description = "Runs FAST verification and builds every backend product."
    dependsOn("verifyFast")
    dependsOn(productBuilds.map { it.task(":testAll") })
    dependsOn(productBuilds.map { it.task(":buildAll") })
}
