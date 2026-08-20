package com.dsbuilder.frontend.cli.feature.theme.data

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.config.ProjectConfigException
import com.dsbuilder.frontend.cli.core.config.ProjectConfigStore
import com.dsbuilder.frontend.cli.core.config.ProjectConfigTenant
import com.dsbuilder.frontend.cli.core.domain.ProjectContext
import com.dsbuilder.frontend.cli.feature.theme.application.LocalThemeWriteResult
import com.dsbuilder.frontend.cli.feature.theme.application.LocalThemeWriter
import com.dsbuilder.frontend.cli.feature.theme.domain.ThemeWritePlan
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/**
 * Adapter записи downloaded theme data в local `.sdds` layout.
 */
internal class LocalThemeFileWriter(
    private val fileSystem: CliFileSystem,
    private val projectConfigStore: ProjectConfigStore,
) : LocalThemeWriter {
    private val json = Json {
        prettyPrint = true
        encodeDefaults = true
    }

    override fun write(
        context: ProjectContext,
        writePlan: ThemeWritePlan,
    ): LocalThemeWriteResult =
        try {
            val sddsDirectory = fileSystem.parent(context.configPath)
                ?: throw ProjectConfigException("Cannot resolve .sdds directory from ${context.configPath}.")

            deleteKnownGeneratedFiles(
                sddsDirectory = sddsDirectory,
                tenantDirectories = knownTenantDirectories(context.configPath, writePlan),
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
                configPath = context.configPath,
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
            LocalThemeWriteResult.Written
        } catch (exception: ProjectConfigException) {
            LocalThemeWriteResult.Failed("Error: ${exception.message}")
        } catch (exception: IllegalStateException) {
            LocalThemeWriteResult.Failed("Error: Cannot write theme files: ${exception.message}")
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
