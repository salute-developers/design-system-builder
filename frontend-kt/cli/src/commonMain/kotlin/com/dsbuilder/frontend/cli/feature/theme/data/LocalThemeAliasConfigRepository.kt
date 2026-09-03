package com.dsbuilder.frontend.cli.feature.theme.data

import com.dsbuilder.frontend.cli.core.config.ProjectConfig
import com.dsbuilder.frontend.cli.core.config.ProjectConfigException
import com.dsbuilder.frontend.cli.core.config.ProjectConfigStore
import com.dsbuilder.frontend.cli.feature.theme.application.ThemeAliasConfigReadResult
import com.dsbuilder.frontend.cli.feature.theme.application.ThemeAliasConfigRepository
import com.dsbuilder.frontend.cli.feature.theme.application.ThemeAliasConfigWriteResult

/**
 * Adapter работы `theme alias` с локальным `.sdds/config.json`.
 */
internal class LocalThemeAliasConfigRepository(
    private val projectConfigStore: ProjectConfigStore,
) : ThemeAliasConfigRepository {
    override fun readNearestConfig(): ThemeAliasConfigReadResult =
        try {
            val context = projectConfigStore.requireNearestContext()
            ThemeAliasConfigReadResult.Found(
                configPath = context.configPath,
                config = context.config,
            )
        } catch (exception: ProjectConfigException) {
            ThemeAliasConfigReadResult.Failed("Error: ${exception.message}")
        }

    override fun writeConfig(
        configPath: String,
        config: ProjectConfig,
    ): ThemeAliasConfigWriteResult =
        try {
            projectConfigStore.updateConfig(configPath) { config }
            ThemeAliasConfigWriteResult.Written
        } catch (exception: ProjectConfigException) {
            ThemeAliasConfigWriteResult.Failed("Error: ${exception.message}")
        }
}
