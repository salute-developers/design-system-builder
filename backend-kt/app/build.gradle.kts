import java.util.zip.ZipFile

plugins {
    id("convention.root-project")
    application
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.plugin.serialization)
    alias(libs.plugins.ktor)
    id("convention.detekt")
    id("convention.spotless")
}
group = "com.dsbuilder.app"
version = "1.0.0"
application { mainClass = "com.dsbuilder.app.ApplicationKt" }
dependencies {
    implementation("com.dsbuilder.identity:runtime:1.0.0")
    implementation("com.dsbuilder.projects:runtime:1.0.0")
    implementation("com.dsbuilder.ds:runtime:1.0.0")
    implementation("com.dsbuilder.documentation:runtime:1.0.0")
    implementation("com.dsbuilder.runtime:runtime-contracts:1.0.0")
    implementation("com.dsbuilder.authorization:authorization-core")
    implementation("com.dsbuilder.identity:feature-auth:1.0.0")
    implementation("com.dsbuilder.projects:feature-projects:1.0.0")
    implementation("com.dsbuilder.projects:core:1.0.0")
    implementation("com.dsbuilder.ds:feature-design-systems:1.0.0")
    implementation("com.dsbuilder.ds:core:1.0.0")
    implementation("com.dsbuilder.documentation:feature-ingestion:1.0.0")
    implementation("com.dsbuilder.documentation:feature-publication:1.0.0")
    implementation("com.dsbuilder.documentation:feature-search:1.0.0")
    implementation(libs.exposed.jdbc)
    implementation(libs.ktor.server.netty)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.server.call.logging)
    implementation(libs.ktor.server.status.pages)
    implementation(libs.ktor.server.cors)
    implementation(libs.ktor.server.config.yaml)
    implementation(libs.ktor.client.cio)
    implementation(libs.koin.ktor)
    implementation(libs.koin.logger.slf4j)
    implementation(libs.logback.classic)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlin.test.junit)
}
tasks.shadowJar {
    mergeServiceFiles()
    filesMatching("META-INF/services/**") { duplicatesStrategy = DuplicatesStrategy.INCLUDE }
    doLast {
        val expected = mutableMapOf<String, MutableSet<String>>()
        project.configurations.getByName("runtimeClasspath").files.filter { it.extension == "jar" }.forEach { jar ->
            ZipFile(jar).use { archive ->
                archive.entries().asSequence()
                    .filter { !it.isDirectory && it.name.startsWith("META-INF/services/") }
                    .forEach { entry ->
                        val providers = archive.getInputStream(entry).bufferedReader().useLines { lines ->
                            lines.map { it.substringBefore('#').trim() }.filter(String::isNotEmpty).toSet()
                        }
                        expected.getOrPut(entry.name) { mutableSetOf() }.addAll(providers)
                    }
            }
        }
        ZipFile(archiveFile.get().asFile).use { packaged ->
            expected.forEach { (path, providers) ->
                val entry = checkNotNull(packaged.getEntry(path)) { "Missing service descriptor $path" }
                val actual = packaged.getInputStream(entry).bufferedReader().useLines { lines ->
                    lines.map { it.substringBefore('#').trim() }.filter(String::isNotEmpty).toSet()
                }
                check(actual.containsAll(providers)) { "Missing providers in $path: ${providers - actual}" }
            }
        }
    }
}

val verifyResourceOwnership by tasks.registering {
    group = "verification"
    description = "Rejects ambiguous application resources before packaging."
    val libraries = configurations.runtimeClasspath
    inputs.files(libraries)
    dependsOn(libraries)
    dependsOn(tasks.processResources)
    doLast {
        val owners = mutableMapOf<String, String>()
        sourceSets.main.get().output.resourcesDir?.walkTopDown()?.filter { it.isFile }?.forEach { resource ->
            val path = resource.relativeTo(sourceSets.main.get().output.resourcesDir!!).invariantSeparatorsPath
            owners[path] = "app resources"
        }
        libraries.get().files.filter { it.extension == "jar" }.forEach { jar ->
            val applicationArchive = jar.canonicalPath.startsWith(rootDir.parentFile.canonicalPath + "/")
            ZipFile(jar).use { archive ->
                archive.entries().asSequence().filterNot { it.isDirectory }.forEach { entry ->
                    val path = entry.name
                    if (applicationArchive && !path.startsWith("META-INF/") ||
                        path.startsWith("dsbuilder/") || path.startsWith("authorization/") ||
                        path in setOf("application.yaml", "logback.xml", "token-definitions.json",
                            "token-initial-values.json", "component-seeds.json")) {
                        val previous = owners.putIfAbsent(path, jar.name)
                        check(previous == null) { "Resource $path is owned by both $previous and ${jar.name}" }
                    }
                }
            }
        }
    }
}
tasks.shadowJar { dependsOn(verifyResourceOwnership) }
tasks.check { dependsOn(verifyResourceOwnership) }
tasks.test { dependsOn(verifyResourceOwnership) }
