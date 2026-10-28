package com.dsbuilder.app

import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.config.yaml.YamlConfig
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

class SubsystemConfigurationTest {
    @Test
    fun `projects retains its own database config when the host has the same keys`() {
        val host = MapApplicationConfig("database.url" to "jdbc:another-subsystem")
        val projects = requireNotNull(YamlConfig("dsbuilder/projects/defaults.yaml"))
        val projectsUrl = projects.property("database.url").getString()
        host.put("database.url", "jdbc:changed-host")
        assertEquals(projectsUrl, projects.property("database.url").getString())
        assertNotEquals(host.property("database.url").getString(), projectsUrl)
        val identity = requireNotNull(YamlConfig("dsbuilder/identity/defaults.yaml"))
        assertEquals(null, identity.propertyOrNull("database.url"))
    }
}
