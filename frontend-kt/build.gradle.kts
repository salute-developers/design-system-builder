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
