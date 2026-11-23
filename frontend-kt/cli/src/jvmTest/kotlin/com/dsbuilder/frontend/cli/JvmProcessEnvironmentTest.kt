package com.dsbuilder.frontend.cli

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class JvmProcessEnvironmentTest {
    private val inherited = mapOf("PATH" to "old-path", "JAVA_HOME" to "old-java")
    private val overrides = mapOf("Path" to "new-path", "java_home" to "new-java")

    @Test
    fun windowsOverridesReplaceDifferentlyCasedInheritedNames() {
        val result = jvmProcessEnvironment(inherited, overrides, windows = true)
        assertEquals(2, result.size)
        assertEquals("new-path", result.entries.single { it.key.equals("path", true) }.value)
        assertEquals("new-java", result.entries.single { it.key.equals("java_home", true) }.value)
    }

    @Test
    fun posixRetainsDistinctCaseAndAnalyticsSecretsAreRemoved() {
        val result = jvmProcessEnvironment(
            inherited,
            overrides + ("dsbuilder_metrica_cli_token" to "test-only"),
            windows = false,
        )
        assertEquals(4, result.size)
        assertEquals("old-path", result["PATH"])
        assertEquals("new-path", result["Path"])
        assertTrue(result.keys.none { it.startsWith("dsbuilder_metrica_", true) })
    }
}
