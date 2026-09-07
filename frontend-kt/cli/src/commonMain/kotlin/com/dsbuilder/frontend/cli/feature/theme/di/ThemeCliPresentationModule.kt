package com.dsbuilder.frontend.cli.feature.theme.di

import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeAliasCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeAliasListCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeAliasSetCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeAliasUnsetCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeFetchCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeGenerateCliCommand
import com.dsbuilder.frontend.feature.theme.application.FetchThemesUseCase
import com.dsbuilder.frontend.feature.theme.application.GenerateThemeUseCase
import com.dsbuilder.frontend.feature.theme.application.ListThemeAliasesUseCase
import com.dsbuilder.frontend.feature.theme.application.SetThemeAliasUseCase
import com.dsbuilder.frontend.feature.theme.application.UnsetThemeAliasUseCase
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для presentation-слоя фичи `theme` в `:cli`.
 */
public fun themeCliPresentationModule(): Module = module {
    single { ThemeFetchCliCommand(get<FetchThemesUseCase>()) }
    single { ThemeAliasListCliCommand(get<ListThemeAliasesUseCase>()) }
    single { ThemeAliasSetCliCommand(get<SetThemeAliasUseCase>()) }
    single { ThemeAliasUnsetCliCommand(get<UnsetThemeAliasUseCase>()) }
    single {
        ThemeAliasCliCommand(
            listCommand = get<ThemeAliasListCliCommand>(),
            setCommand = get<ThemeAliasSetCliCommand>(),
            unsetCommand = get<ThemeAliasUnsetCliCommand>(),
        )
    }
    single { ThemeGenerateCliCommand(get<GenerateThemeUseCase>()) }
    single {
        ThemeCliCommand(
            fetchCommand = get<ThemeFetchCliCommand>(),
            generateCommand = get<ThemeGenerateCliCommand>(),
            aliasCommand = get<ThemeAliasCliCommand>(),
        )
    }
    single<CliktCommand> { get<ThemeCliCommand>() }
}
