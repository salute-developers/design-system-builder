plugins {
    `java-library`
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.plugin.serialization)
    id("convention.detekt")
    id("convention.spotless")
}

dependencies {
    implementation("com.dsbuilder.authorization:authorization-core")
    implementation("com.dsbuilder.runtime:runtime-contracts")
    api(project(":feature-chat"))
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.cio)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.kotlin.test.junit)
}

tasks.processResources {
    eachFile { path = "dsbuilder/ai/$path" }
    includeEmptyDirs = false
}

/** Эталонные сценарии ИИ-чата против поднятого контура; без ключа или контура завершается ошибкой. */
tasks.register<JavaExec>("evalChat") {
    group = "verification"
    description = "Runs AI chat reference scenarios against a running local stack (needs EVAL_* variables)."
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("com.dsbuilder.ai.eval.EvalChatKt")
    workingDir = rootDir
    args(rootDir.resolve("evals/scenarios.json").absolutePath)
}
