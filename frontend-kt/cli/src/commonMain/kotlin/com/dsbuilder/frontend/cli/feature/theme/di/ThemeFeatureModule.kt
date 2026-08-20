package com.dsbuilder.frontend.cli.feature.theme.di

import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.cli.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.cli.core.application.ProjectContextReader
import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.config.ProjectConfigStore
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.cli.feature.theme.application.FetchThemesUseCase
import com.dsbuilder.frontend.cli.feature.theme.application.ListThemeAliasesUseCase
import com.dsbuilder.frontend.cli.feature.theme.application.LocalThemeWriter
import com.dsbuilder.frontend.cli.feature.theme.application.RemoteThemeDataSource
import com.dsbuilder.frontend.cli.feature.theme.application.SetThemeAliasUseCase
import com.dsbuilder.frontend.cli.feature.theme.application.ThemeAliasConfigRepository
import com.dsbuilder.frontend.cli.feature.theme.application.UnsetThemeAliasUseCase
import com.dsbuilder.frontend.cli.feature.theme.data.HttpRemoteThemeDataSource
import com.dsbuilder.frontend.cli.feature.theme.data.LocalThemeAliasConfigRepository
import com.dsbuilder.frontend.cli.feature.theme.data.LocalThemeFileWriter
import com.dsbuilder.frontend.cli.feature.theme.domain.ThemeWritePlanBuilder
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeAliasCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeAliasListCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeAliasSetCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeAliasUnsetCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeCliCommand
import com.dsbuilder.frontend.cli.feature.theme.presentation.ThemeFetchCliCommand
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для feature `theme`.
 */
public fun themeFeatureModule(): Module = module {
    single<RemoteThemeDataSource> { HttpRemoteThemeDataSource(get<AuthenticatedHttpClientFactory>()) }
    single { ThemeWritePlanBuilder() }
    single<LocalThemeWriter> {
        LocalThemeFileWriter(
            fileSystem = get<CliFileSystem>(),
            projectConfigStore = get<ProjectConfigStore>(),
        )
    }
    single<ThemeAliasConfigRepository> { LocalThemeAliasConfigRepository(get<ProjectConfigStore>()) }
    single { ListThemeAliasesUseCase(get<ThemeAliasConfigRepository>()) }
    single { SetThemeAliasUseCase(get<ThemeAliasConfigRepository>()) }
    single { UnsetThemeAliasUseCase(get<ThemeAliasConfigRepository>()) }
    single {
        FetchThemesUseCase(
            projectContextReader = get<ProjectContextReader>(),
            projectApiKeyProvider = get<ProjectApiKeyProvider>(),
            projectApiUrlProvider = get<ProjectApiUrlProvider>(),
            remoteThemeDataSource = get<RemoteThemeDataSource>(),
            writePlanBuilder = get<ThemeWritePlanBuilder>(),
            localThemeWriter = get<LocalThemeWriter>(),
        )
    }
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
    single { ThemeCliCommand(get<ThemeFetchCliCommand>(), get<ThemeAliasCliCommand>()) }
    single<CliktCommand> { get<ThemeCliCommand>() }
}
