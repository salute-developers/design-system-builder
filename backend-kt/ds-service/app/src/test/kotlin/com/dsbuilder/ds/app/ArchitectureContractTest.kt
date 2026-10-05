package com.dsbuilder.ds.app

import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.extension
import kotlin.io.path.isDirectory
import kotlin.io.path.name
import kotlin.io.path.readText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ArchitectureContractTest {
    private val root = locateRoot()

    @Test
    fun `feature modules do not depend on each other`() {
        featureDirectories().forEach { feature ->
            val build = feature.resolve("build.gradle.kts").readText()
            assertFalse(build.contains("project(\":feature-"), "${feature.name} depends on another feature")
        }
    }

    @Test
    fun `layers only import allowed technologies`() {
        kotlinSources().forEach { source ->
            val normalized = source.toString().replace('\\', '/')
            val text = source.readText()
            if ("/domain/" in normalized) {
                assertFalse(text.contains("io.ktor."), "$source imports Ktor from domain")
                assertFalse(text.contains("org.jetbrains.exposed."), "$source imports Exposed from domain")
                assertFalse(text.contains("org.koin."), "$source imports Koin from domain")
            }
            if ("/application/" in normalized) {
                assertFalse(text.contains("io.ktor."), "$source imports Ktor from application")
                assertFalse(text.contains("org.jetbrains.exposed."), "$source imports Exposed from application")
            }
            if ("/presentation/" in normalized) {
                assertFalse(text.contains("org.jetbrains.exposed."), "$source imports Exposed from presentation")
            }
        }
    }

    @Test
    fun `application scenarios are explicit use cases`() {
        val forbiddenName = Regex("class\\s+\\w+(Queries|Commands|Operations)\\b")
        kotlinSources().filter { "/application/" in it.toString().replace('\\', '/') }.forEach { source ->
            val text = source.readText()
            assertFalse(forbiddenName.containsMatchIn(text), "$source contains an aggregate application class")
            assertFalse(
                Regex("class\\s+\\w*Crud\\w*UseCase").containsMatchIn(text),
                "$source contains a generic CRUD use case",
            )
            if (Regex("class\\s+\\w+UseCase\\b").containsMatchIn(text)) {
                assertEquals(
                    1,
                    Regex("\\bfun\\s+execute\\s*\\(").findAll(text).count(),
                    "$source must expose one execute",
                )
            }
        }
    }

    @Test
    fun `public top level types have their own files`() {
        val topLevelType = Regex(
            "^(?:data\\s+|sealed\\s+|value\\s+|enum\\s+|fun\\s+)?(?:class|interface|object)\\s+\\w+",
            RegexOption.MULTILINE,
        )
        kotlinSources().forEach { source ->
            assertTrue(
                topLevelType.findAll(source.readText()).count() <= 1,
                "$source contains unrelated public top-level types",
            )
        }
    }

    @Test
    fun `authorization core contracts are not copied locally`() {
        val forbidden = setOf(
            "AuthorizationPolicy",
            "PolicyEvaluator",
            "ProjectPrincipal",
            "TrustedProjectPrincipalFactory",
        )
        kotlinSources().forEach { source ->
            val declarations = Regex("^(?:data\\s+)?(?:class|interface|object)\\s+(\\w+)", RegexOption.MULTILINE)
                .findAll(source.readText())
                .map { it.groupValues[1] }
                .toSet()
            assertTrue(declarations.intersect(forbidden).isEmpty(), "$source copies authorization-core contracts")
        }
    }

    private fun featureDirectories(): List<Path> = Files.list(root).use { stream ->
        stream.filter { it.isDirectory() && it.name.startsWith("feature-") }.toList()
    }

    private fun kotlinSources(): List<Path> = Files.walk(root).use { stream ->
        stream.filter { it.extension == "kt" && "/build/" !in it.toString().replace('\\', '/') }.toList()
    }

    private fun locateRoot(): Path {
        var candidate = Path.of(System.getProperty("user.dir")).toAbsolutePath()
        repeat(4) {
            if (
                Files.exists(candidate.resolve("settings.gradle.kts")) &&
                Files.exists(candidate.resolve("feature-components"))
            ) {
                return candidate
            }
            candidate = candidate.parent
        }
        error("Unable to locate ds-service root")
    }
}
