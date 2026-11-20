plugins {
    `java-library`
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.plugin.serialization)
    id("convention.detekt")
    id("convention.spotless")
}

/**
 * Прогон эталонных сценариев ИИ-чата живёт в отдельном наборе исходников `eval`: это утилита разработчика с `main` и
 * `exitProcess`, в прод-jar она попадать не должна.
 */
val eval: SourceSet by sourceSets.creating {
    compileClasspath += sourceSets["main"].output + sourceSets["main"].compileClasspath
    runtimeClasspath += output + compileClasspath + sourceSets["main"].runtimeClasspath
}

kotlin {
    // Тесты видят internal-объявления прогона так же, как основного кода.
    target.compilations.getByName("test").associateWith(target.compilations.getByName("eval"))
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
    classpath = eval.runtimeClasspath
    mainClass.set("com.dsbuilder.ai.eval.EvalChatKt")
    workingDir = rootDir
    args(rootDir.resolve("evals/scenarios.json").absolutePath)
}
