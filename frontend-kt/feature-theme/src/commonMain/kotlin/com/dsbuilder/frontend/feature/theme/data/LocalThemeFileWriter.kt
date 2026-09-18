package com.dsbuilder.frontend.feature.theme.data

import com.dsbuilder.frontend.core.domain.CredentialPolicy
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.workspace.CredentialReference
import com.dsbuilder.frontend.core.workspace.CredentialReferenceType
import com.dsbuilder.frontend.core.workspace.ProjectConfig
import com.dsbuilder.frontend.core.workspace.ProjectConfigException
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.core.workspace.ProjectConfigTenant
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.theme.application.LocalThemeWriteResult
import com.dsbuilder.frontend.feature.theme.application.LocalThemeWriter
import com.dsbuilder.frontend.feature.theme.domain.ThemeWritePlan
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/**
 * Adapter записи downloaded theme data в local `.sdds` layout.
 */
internal class LocalThemeFileWriter(
    private val fileSystem: WorkspaceFileSystem,
    private val projectConfigStore: ProjectConfigStore,
) : LocalThemeWriter {
    private val json = Json {
        prettyPrint = true
        encodeDefaults = true
    }

    override fun write(
        context: ProjectContext,
        writePlan: ThemeWritePlan,
        destinationDirectory: String?,
    ): LocalThemeWriteResult =
        try {
            val configPath = resolveConfigPath(context, destinationDirectory)
            val sddsDirectory = fileSystem.parent(configPath)
                ?: throw ProjectConfigException("Cannot resolve .sdds directory from $configPath.")

            deleteKnownGeneratedFiles(
                sddsDirectory = sddsDirectory,
                tenantDirectories = knownTenantDirectories(configPath, writePlan),
            )
            fileSystem.deleteFile(fileSystem.resolve(sddsDirectory, PALETTE_PATH_WITHOUT_CONFIG_DIRECTORY))

            for (file in writePlan.files) {
                val tenantDirectory = fileSystem.resolve(sddsDirectory, "$TENANTS_DIRECTORY/${file.tenantDirectory}")
                val filePath = file.relativePath.split("/")
                    .fold(tenantDirectory) { parent, child -> fileSystem.resolve(parent, child) }
                fileSystem.parent(filePath)?.let(fileSystem::createDirectories)
                fileSystem.writeText(filePath, file.content)
            }

            val palettePath = fileSystem.resolve(sddsDirectory, PALETTE_PATH_WITHOUT_CONFIG_DIRECTORY)
            fileSystem.parent(palettePath)?.let(fileSystem::createDirectories)
            fileSystem.writeText(palettePath, json.encodeToString<JsonObject>(writePlan.palette.content))

            projectConfigStore.updateTenantsPreservingAliases(
                configPath = configPath,
                tenants = writePlan.tenantDirectories.map {
                    val tenant = it.tenant
                    ProjectConfigTenant(
                        id = tenant.id,
                        designSystemId = tenant.designSystemId,
                        name = tenant.name,
                        description = tenant.description,
                        directoryPath = ".sdds/$TENANTS_DIRECTORY/${it.directoryName}",
                        createdAt = tenant.createdAt,
                        updatedAt = tenant.updatedAt,
                    )
                },
                palettePath = PALETTE_PATH,
            )
            LocalThemeWriteResult.Written(configPath)
        } catch (exception: ProjectConfigException) {
            LocalThemeWriteResult.Failed("Error: ${exception.message}")
        } catch (exception: IllegalStateException) {
            LocalThemeWriteResult.Failed("Error: Cannot write theme files: ${exception.message}")
        }

    private fun resolveConfigPath(context: ProjectContext, destinationDirectory: String?): String {
        if (destinationDirectory == null) return context.configPath
        val directory = fileSystem.absolutePath(destinationDirectory)
        return projectConfigStore.createConfig(
            directory,
            ProjectConfig(
                projectId = context.projectId.value,
                designSystemId = context.designSystemId.value,
                credential = CredentialReference(
                    type = when (context.credentialPolicy) {
                        CredentialPolicy.AUTO -> CredentialReferenceType.AUTO
                        CredentialPolicy.USER_SESSION -> CredentialReferenceType.USER_SESSION
                        CredentialPolicy.PROJECT_KEY_ENV -> CredentialReferenceType.PROJECT_KEY_ENV
                    },
                    name = context.credentialEnvName.value,
                ),
                platforms = context.platforms.map { it.cliValue },
            ),
        )
    }

    private fun knownTenantDirectories(
        configPath: String,
        writePlan: ThemeWritePlan,
    ): Set<String> {
        val previousDirectories = projectConfigStore.readConfig(configPath)
            .tenants
            .mapNotNull { it.directoryPath?.removePrefix(".sdds/") }
        val currentDirectories = writePlan.tenantDirectories.flatMap {
            listOf(it.directoryName, "$TENANTS_DIRECTORY/${it.directoryName}")
        }

        return (previousDirectories + currentDirectories).toSet()
    }

    private fun deleteKnownGeneratedFiles(
        sddsDirectory: String,
        tenantDirectories: Set<String>,
    ) {
        for (tenantDirectoryName in tenantDirectories) {
            val tenantDirectory = fileSystem.resolve(sddsDirectory, tenantDirectoryName)
            fileSystem.deleteFile(fileSystem.resolve(tenantDirectory, META_FILE_NAME))
            for (platform in GENERATED_PLATFORMS) {
                deleteGeneratedPlatformFiles(
                    platformDirectory = fileSystem.resolve(tenantDirectory, platform),
                    platform = platform,
                )
            }
        }
    }

    private fun deleteGeneratedPlatformFiles(
        platformDirectory: String,
        platform: String,
    ) {
        fileSystem.listFiles(platformDirectory)
            .filter { it.fileName().startsWith("${platform}_") }
            .filter { it.endsWith(JSON_EXTENSION) }
            .forEach(fileSystem::deleteFile)
    }

    private fun String.fileName(): String = substringAfterLast("/").substringAfterLast("\\")
}

private const val META_FILE_NAME = "meta.json"
private const val TENANTS_DIRECTORY = "tenants"
private const val PALETTE_FILE_NAME = "palette.json"
private const val PALETTE_PATH = ".sdds/$TENANTS_DIRECTORY/$PALETTE_FILE_NAME"
private const val PALETTE_PATH_WITHOUT_CONFIG_DIRECTORY = "$TENANTS_DIRECTORY/$PALETTE_FILE_NAME"
private const val JSON_EXTENSION = ".json"
private val GENERATED_PLATFORMS = setOf("android", "ios", "web")
