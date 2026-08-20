package com.dsbuilder.frontend.cli.di

import com.dsbuilder.frontend.cli.feature.components.presentation.ComponentsCliCommand
import com.dsbuilder.frontend.cli.feature.init.presentation.InitCliCommand
import com.dsbuilder.frontend.cli.feature.status.presentation.StatusCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeCliCommand
import com.dsbuilder.frontend.cli.presentation.RootCliCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для root CLI presentation.
 */
public fun cliModule(): Module = module {
    single {
        val initCommand = get<InitCliCommand>()
        val statusCommand = get<StatusCliCommand>()
        val themeCommand = get<ThemeCliCommand>()
        val componentsCommand = get<ComponentsCliCommand>()

        RootCliCommand(
            cliktSubcommands = listOf(initCommand, statusCommand, themeCommand, componentsCommand),
        )
    }
}
