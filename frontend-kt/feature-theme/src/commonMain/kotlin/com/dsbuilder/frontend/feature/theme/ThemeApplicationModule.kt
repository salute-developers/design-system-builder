package com.dsbuilder.frontend.feature.theme

import com.dsbuilder.frontend.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.platform.PlatformCapabilityRunner
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.theme.application.FetchThemesUseCase
import com.dsbuilder.frontend.feature.theme.application.GenerateThemeUseCase
import com.dsbuilder.frontend.feature.theme.application.ListThemeAliasesUseCase
import com.dsbuilder.frontend.feature.theme.application.LocalThemeWriter
import com.dsbuilder.frontend.feature.theme.application.RemoteThemeDataSource
import com.dsbuilder.frontend.feature.theme.application.SetThemeAliasUseCase
import com.dsbuilder.frontend.feature.theme.application.ThemeAliasConfigRepository
import com.dsbuilder.frontend.feature.theme.application.UnsetThemeAliasUseCase
import com.dsbuilder.frontend.feature.theme.data.HttpRemoteThemeDataSource
import com.dsbuilder.frontend.feature.theme.data.LocalThemeAliasConfigRepository
import com.dsbuilder.frontend.feature.theme.data.LocalThemeFileWriter
import com.dsbuilder.frontend.feature.theme.domain.ThemeWritePlanBuilder
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для прикладного слоя фичи `theme`.
 */
public fun themeApplicationModule(): Module = module {
    single<RemoteThemeDataSource> { HttpRemoteThemeDataSource(get<AuthenticatedHttpClientFactory>()) }
    single { ThemeWritePlanBuilder() }
    single<LocalThemeWriter> {
        LocalThemeFileWriter(
            fileSystem = get<WorkspaceFileSystem>(),
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
    single { GenerateThemeUseCase(get<PlatformCapabilityRunner>()) }
}
