plugins {
    id("convention.feature-module")
    id("convention.detekt")
    id("convention.spotless")
}

val generatedTokenDefinitions = layout.buildDirectory.file("generated/resources/token-definitions.json")
val tokenDefinitionsSource = file("../../../js/services/db-service/src/db/seeds/prod/tokens.ts")
val tsx = file("../../../js/services/db-service/node_modules/.bin/tsx")

val generateTokenDefinitions by tasks.registering {
    inputs.file(tokenDefinitionsSource)
    outputs.file(generatedTokenDefinitions)
    doLast {
        check(tsx.canExecute()) { "db-service tsx is required to generate token definitions" }
        val process = ProcessBuilder(
            tsx.absolutePath,
            "-e",
            "import { TOKEN_DEFS, stripModePrefix } from '${tokenDefinitionsSource.absolutePath}'; " +
                "console.log(JSON.stringify(TOKEN_DEFS.map((value) => ({...value, name: stripModePrefix(value.name, value.type)}))))",
        ).redirectErrorStream(false).start()
        val output = process.inputStream.bufferedReader().readText()
        val errors = process.errorStream.bufferedReader().readText()
        check(process.waitFor() == 0) { "Unable to generate token definitions: $errors" }
        generatedTokenDefinitions.get().asFile.apply {
            parentFile.mkdirs()
            writeText(output)
        }
    }
}

sourceSets.main {
    resources.srcDir(generatedTokenDefinitions.map { it.asFile.parentFile })
}

tasks.processResources {
    dependsOn(generateTokenDefinitions)
}

dependencies {
    implementation("com.dsbuilder.authorization:authorization-core")
    implementation(project(":core"))
    implementation(libs.exposed.json)

    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlinx.coroutines.core)
    testImplementation(libs.kotlin.test.junit)
}
