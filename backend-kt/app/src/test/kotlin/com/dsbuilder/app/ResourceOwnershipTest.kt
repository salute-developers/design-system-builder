package com.dsbuilder.app

import org.koin.dsl.koinApplication
import org.koin.dsl.module
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertNotNull

class ResourceOwnershipTest {
    @Test
    fun `each subsystem has one unambiguous resource namespace`() {
        val paths = listOf(
            "dsbuilder/projects/openapi/documentation.yaml",
            "dsbuilder/identity/defaults.yaml",
            "dsbuilder/ds/openapi/documentation.yaml",
            "dsbuilder/documentation/openapi/documentation.yaml",
            "dsbuilder/ds/db/migration/V1__db_service_baseline.sql",
            "dsbuilder/documentation/db/migration/V1__documentation_schema.sql",
            "authorization/policy.json",
        )
        for (path in paths) {
            val resources = javaClass.classLoader.getResources(path).toList()
            assertEquals(1, resources.size, path)
            assertNotNull(resources.single().openStream().use { it.readBytes() })
        }
    }

    @Test
    fun `duplicate bindings cannot silently replace a subsystem dependency`() {
        assertFails {
            koinApplication {
                allowOverride(false)
                modules(module { single<String> { "first" } }, module { single<String> { "second" } })
            }.close()
        }
    }
}
