import org.gradle.api.tasks.testing.Test
import org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

val integrationCategory = "com.dsbuilder.testing.IntegrationTest"
val localFixtures = rootProject.file("build-system/src/testFixtures/kotlin")
val fixtures = if (localFixtures.isDirectory) localFixtures else
    rootProject.file("../build-system/src/testFixtures/kotlin")

pluginManager.withPlugin("org.jetbrains.kotlin.jvm") {
    extensions.configure<KotlinJvmProjectExtension> {
        sourceSets.named("test") { kotlin.srcDir(fixtures) }
    }
}
pluginManager.withPlugin("org.jetbrains.kotlin.multiplatform") {
    extensions.configure<KotlinMultiplatformExtension> {
        sourceSets.matching { it.name == "jvmTest" }.configureEach { kotlin.srcDir(fixtures) }
    }
}

afterEvaluate {
    tasks.withType<Test>().filter { it.name == "test" || it.name == "jvmTest" }.forEach { unit ->
        val integrationName = if (unit.name == "test") "integrationTest" else "jvmIntegrationTest"
        val integration = tasks.register<Test>(integrationName) {
            group = "verification"
            description = "Runs JVM integration tests with external infrastructure."
            testClassesDirs = unit.testClassesDirs
            classpath = unit.classpath
            // Preserve preparation tasks supplied by JVM/IDE plugins and the module itself.
            dependsOn(provider { unit.taskDependencies.getDependencies(unit) })
            javaLauncher.set(unit.javaLauncher)
            systemProperties(unit.systemProperties)
            environment(unit.environment)
            setJvmArgs(unit.jvmArgs ?: emptyList<String>())
            maxHeapSize = unit.maxHeapSize
            useJUnit { includeCategories(integrationCategory) }
            shouldRunAfter(unit)
        }
        unit.useJUnit { excludeCategories(integrationCategory) }
        tasks.matching { it.name == "check" || it.name == "allTests" }.configureEach {
            dependsOn(integration)
        }
    }
}
