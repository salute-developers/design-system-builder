package com.dsbuilder.frontend.core.workspace

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Перенесено из `cli/DsBuilderCliTest.kt` при выносе `core.config` в отдельный
 * Gradle-модуль `core-workspace` (ADR-0004).
 */
class ProjectConfigStoreAndCodecTest {
    @Test
    fun configCodecSerializesProjectAndCredentialReferenceOnly() {
        val codec = ProjectConfigCodec()

        val text = codec.encode(projectConfig())
        val decoded = codec.decode(text)

        assertEquals("project-a", decoded.projectId)
        assertEquals("design-system-a", decoded.designSystemId)
        assertEquals("DSBUILDER_PROJECT_A_API_KEY", decoded.credential.name)
        assertFalse(text.contains("apiKey"))
        assertFalse(text.contains("apiUrl"))
        assertFalse(text.contains("secret-value"))
    }

    @Test
    fun configCodecReadsConfigWithoutTenantsAndWritesConfigWithTenants() {
        val codec = ProjectConfigCodec()
        val legacy = """
            {
              "projectId": "project-a",
              "designSystemId": "design-system-a",
              "credential": {
                "type": "env",
                "name": "DSBUILDER_PROJECT_A_API_KEY"
              }
            }
        """.trimIndent()

        val decodedLegacy = codec.decode(legacy)
        val encoded = codec.encode(
            decodedLegacy.copy(
                tenants = listOf(
                    ProjectConfigTenant(
                        id = "tenant-a",
                        designSystemId = "design-system-a",
                        name = "SDDS CS",
                        description = "Tenant",
                        createdAt = "2026-06-04T07:37:55.526Z",
                        updatedAt = "2026-06-04T07:37:55.526Z",
                        alias = "main",
                    ),
                ),
            ),
        )
        val decodedWithTenants = codec.decode(encoded)

        assertEquals(emptyList(), decodedLegacy.tenants)
        assertEquals(null, decodedLegacy.palettePath)
        assertEquals("tenant-a", decodedWithTenants.tenants.single().id)
        assertEquals(null, decodedWithTenants.tenants.single().directoryPath)
        assertEquals("main", decodedWithTenants.tenants.single().alias)
        assertFalse(encoded.contains("apiKey"))
        assertFalse(encoded.contains("apiUrl"))
        assertFalse(encoded.contains("secret-value"))
    }

    @Test
    fun configCodecReadsTenantsWithoutAlias() {
        val codec = ProjectConfigCodec()
        val text = """
            {
              "projectId": "project-a",
              "designSystemId": "design-system-a",
              "credential": {
                "type": "env",
                "name": "DSBUILDER_PROJECT_A_API_KEY"
              },
              "tenants": [
                {
                  "id": "tenant-a",
                  "designSystemId": "design-system-a",
                  "name": "SDDS CS",
                  "description": "Tenant",
                  "directoryPath": ".sdds/sdds_cs",
                  "createdAt": "2026-06-04T07:37:55.526Z",
                  "updatedAt": "2026-06-04T07:37:55.526Z"
                }
              ]
            }
        """.trimIndent()

        val decoded = codec.decode(text)

        assertEquals(null, decoded.tenants.single().alias)
    }

    @Test
    fun configCodecReadsAndWritesPalettePath() {
        val codec = ProjectConfigCodec()
        val encoded = codec.encode(projectConfig().copy(palettePath = ".sdds/tenants/palette.json"))
        val decoded = codec.decode(encoded)

        assertEquals(".sdds/tenants/palette.json", decoded.palettePath)
        assertFalse(encoded.contains("apiKey"))
        assertFalse(encoded.contains("apiUrl"))
    }

    @Test
    fun configStoreUpdatesTenantsAndPreservesProjectCredentialMetadata() {
        val fileSystem = initializedFileSystem()
        val store = ProjectConfigStore(fileSystem)
        val context = store.requireNearestContext()

        store.updateTenants(
            context = context,
            tenants = listOf(configTenant("tenant-a")),
        )
        val updated = ProjectConfigCodec().decode(fileSystem.readText("/repo/.sdds/config.json"))

        assertEquals("project-a", updated.projectId)
        assertEquals("design-system-a", updated.designSystemId)
        assertEquals("DSBUILDER_PROJECT_A_API_KEY", updated.credential.name)
        assertEquals("tenant-a", updated.tenants.single().id)
        assertEquals(".sdds/tenants/sdds_cs", updated.tenants.single().directoryPath)
        assertEquals(null, updated.palettePath)
    }

    @Test
    fun configStoreUpdatesTenantsPreservingAliasesByTenantId() {
        val fileSystem = initializedFileSystem()
        val store = ProjectConfigStore(fileSystem)
        store.updateConfig("/repo/.sdds/config.json") { config ->
            config.copy(palettePath = ".sdds/tenants/palette.json")
        }
        store.updateTenants(
            configPath = "/repo/.sdds/config.json",
            tenants = listOf(
                configTenant("tenant-a").copy(alias = "main"),
                configTenant("removed-tenant").copy(alias = "removed"),
            ),
        )

        store.updateTenantsPreservingAliases(
            configPath = "/repo/.sdds/config.json",
            tenants = listOf(
                configTenant("tenant-a").copy(name = "Fresh Tenant"),
                configTenant("tenant-b"),
            ),
        )
        val updated = ProjectConfigCodec().decode(fileSystem.readText("/repo/.sdds/config.json"))

        assertEquals("main", updated.tenants.first { it.id == "tenant-a" }.alias)
        assertEquals("Fresh Tenant", updated.tenants.first { it.id == "tenant-a" }.name)
        assertEquals(null, updated.tenants.first { it.id == "tenant-b" }.alias)
        assertFalse(updated.tenants.any { it.id == "removed-tenant" })
        assertEquals(".sdds/tenants/palette.json", updated.palettePath)
        assertFalse(fileSystem.readText("/repo/.sdds/config.json").contains("apiUrl"))
    }

    @Test
    fun configDiscoveryUsesCurrentDirectoryConfig() {
        val fileSystem = FakeWorkspaceFileSystem(currentDirectory = "/repo/package-a")
        fileSystem.writeText("/repo/package-a/.sdds/config.json", ProjectConfigCodec().encode(projectConfig("current")))

        val context = ProjectConfigStore(fileSystem).requireNearestContext()

        assertEquals("current", context.config.projectId)
        assertEquals("/repo/package-a/.sdds/config.json", context.configPath)
    }

    @Test
    fun configDiscoveryUsesNearestParentConfig() {
        val fileSystem = FakeWorkspaceFileSystem(currentDirectory = "/repo/package-a/src")
        fileSystem.writeText("/repo/.sdds/config.json", ProjectConfigCodec().encode(projectConfig("root")))
        fileSystem.writeText("/repo/package-a/.sdds/config.json", ProjectConfigCodec().encode(projectConfig("nearest")))

        val context = ProjectConfigStore(fileSystem).requireNearestContext()

        assertEquals("nearest", context.config.projectId)
        assertEquals("/repo/package-a/.sdds/config.json", context.configPath)
    }

    @Test
    fun missingConfigReturnsDeterministicError() {
        val exception = assertFailsWith<ProjectConfigException> {
            ProjectConfigStore(FakeWorkspaceFileSystem(currentDirectory = "/repo")).requireNearestContext()
        }

        assertNotNull(exception.message)
        assertTrue(exception.message!!.contains("Project is not initialized"))
    }

    private fun projectConfig(projectId: String = "project-a"): ProjectConfig = ProjectConfig(
        projectId = projectId,
        designSystemId = "design-system-a",
        credential = CredentialReference(
            type = CredentialReferenceType.ENV,
            name = "DSBUILDER_PROJECT_A_API_KEY",
        ),
    )

    private fun configTenant(id: String): ProjectConfigTenant = ProjectConfigTenant(
        id = id,
        designSystemId = "design-system-a",
        name = "SDDS CS",
        description = "Tenant",
        directoryPath = ".sdds/tenants/sdds_cs",
        createdAt = "2026-06-04T07:37:55.526Z",
        updatedAt = "2026-06-04T07:37:55.526Z",
    )

    private fun initializedFileSystem(): FakeWorkspaceFileSystem {
        val fileSystem = FakeWorkspaceFileSystem(currentDirectory = "/repo/src")
        fileSystem.writeText("/repo/.sdds/config.json", ProjectConfigCodec().encode(projectConfig()))
        return fileSystem
    }
}
