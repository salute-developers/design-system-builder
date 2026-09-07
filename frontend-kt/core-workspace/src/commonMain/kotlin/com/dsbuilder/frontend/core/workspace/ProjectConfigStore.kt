package com.dsbuilder.frontend.core.workspace

private const val CONFIG_DIRECTORY = ".sdds"
private const val CONFIG_FILE = "config.json"

/**
 * Project context, найденный через nearest-parent `.sdds/config.json`.
 *
 * @property config project config.
 * @property configPath абсолютный или runtime-relative путь найденного config.
 */
public data class ProjectContext(
    public val config: ProjectConfig,
    public val configPath: String,
)

/**
 * Читает, пишет и ищет локальный project config CLI.
 */
public class ProjectConfigStore(
    private val fileSystem: WorkspaceFileSystem,
    private val codec: ProjectConfigCodec = ProjectConfigCodec(),
) {
    /**
     * Ищет ближайший `.sdds/config.json` вверх от текущей директории.
     */
    public fun requireNearestContext(startDirectory: String = fileSystem.currentWorkingDirectory()): ProjectContext {
        val configPath = findNearestConfigPath(startDirectory)
            ?: throw ProjectConfigException(
                "Project is not initialized. Run `dsbuilder init --project-id <id> --design-system-id <id>`.",
            )
        val config = codec.decode(fileSystem.readText(configPath))

        return ProjectContext(config = config, configPath = configPath)
    }

    /**
     * Создает `.sdds/config.json` в target directory без silent overwrite.
     */
    public fun createConfig(
        targetDirectory: String,
        config: ProjectConfig,
    ): String {
        val configDirectory = fileSystem.resolve(targetDirectory, CONFIG_DIRECTORY)
        val configPath = fileSystem.resolve(configDirectory, CONFIG_FILE)
        if (fileSystem.exists(configPath)) {
            throw ProjectConfigException("Project config already exists at $configPath.")
        }

        fileSystem.createDirectories(configDirectory)
        fileSystem.writeText(configPath, codec.encode(config))

        return configPath
    }

    /**
     * Читает `.sdds/config.json` по известному пути.
     */
    public fun readConfig(configPath: String): ProjectConfig = codec.decode(fileSystem.readText(configPath))

    /**
     * Обновляет `tenants` в существующем `.sdds/config.json`, сохраняя project metadata и credential reference.
     */
    public fun updateTenants(
        context: ProjectContext,
        tenants: List<ProjectConfigTenant>,
    ) {
        val updated = context.config.copy(tenants = tenants)
        fileSystem.writeText(context.configPath, codec.encode(updated))
    }

    /**
     * Обновляет project config по известному пути, перечитывая текущий файл перед записью.
     */
    public fun updateConfig(
        configPath: String,
        transform: (ProjectConfig) -> ProjectConfig,
    ) {
        val config = readConfig(configPath)
        fileSystem.writeText(configPath, codec.encode(transform(config)))
    }

    /**
     * Обновляет `tenants` в config по известному пути, перечитывая текущий файл перед записью.
     */
    public fun updateTenants(
        configPath: String,
        tenants: List<ProjectConfigTenant>,
    ) {
        updateConfig(configPath) { config -> config.copy(tenants = tenants) }
    }

    /**
     * Обновляет `tenants`, сохраняя локальные aliases для совпадающих `tenant.id`.
     */
    public fun updateTenantsPreservingAliases(
        configPath: String,
        tenants: List<ProjectConfigTenant>,
        palettePath: String? = null,
    ) {
        updateConfig(configPath) { config ->
            val aliasesByTenantId = config.tenants
                .mapNotNull { tenant -> tenant.alias?.let { alias -> tenant.id to alias } }
                .toMap()
            config.copy(
                tenants = tenants.map { tenant -> tenant.copy(alias = aliasesByTenantId[tenant.id]) },
                palettePath = palettePath ?: config.palettePath,
            )
        }
    }

    private fun findNearestConfigPath(startDirectory: String): String? {
        var current: String? = startDirectory
        while (current != null) {
            val configPath = fileSystem.resolve(fileSystem.resolve(current, CONFIG_DIRECTORY), CONFIG_FILE)
            if (fileSystem.exists(configPath)) {
                return configPath
            }
            current = fileSystem.parent(current)
        }

        return null
    }
}
