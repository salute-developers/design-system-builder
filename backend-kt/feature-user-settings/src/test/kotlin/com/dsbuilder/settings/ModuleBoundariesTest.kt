package com.dsbuilder.settings

import com.lemonappdev.konsist.api.Konsist
import kotlin.test.Test
import kotlin.test.assertFalse

class ModuleBoundariesTest {
    @Test
    fun `domain and application do not import infrastructure or projects feature`() {
        val files = Konsist.scopeFromProduction().files.filter { "/feature-user-settings/" in it.path }
        for (file in files) {
            assertFalse(file.imports.any { it.name.startsWith("com.dsbuilder.projects") }, file.name)
            if ("/application/" in file.path || "/domain/" in file.path) {
                val forbidden =
                    listOf(
                        "io.ktor",
                        "org.jetbrains.exposed",
                        "com.zaxxer",
                        "org.flywaydb",
                        "com.dsbuilder.settings.data",
                        "com.dsbuilder.settings.presentation",
                        "com.dsbuilder.settings.di",
                    )
                assertFalse(file.imports.any { imported -> forbidden.any(imported.name::startsWith) }, file.name)
            }
        }
    }
}
