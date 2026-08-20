package com.dsbuilder.frontend.cli.feature.components.di

import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.cli.core.application.ProjectContextReader
import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.http.ApiUrlResolver
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.cli.feature.components.application.ComponentConfigRemoteSource
import com.dsbuilder.frontend.cli.feature.components.application.ComponentPackageLoader
import com.dsbuilder.frontend.cli.feature.components.application.PushComponentsUseCase
import com.dsbuilder.frontend.cli.feature.components.data.DefaultComponentPackageLoader
import com.dsbuilder.frontend.cli.feature.components.data.HttpComponentConfigRemoteSource
import com.dsbuilder.frontend.cli.feature.components.domain.codec.ConfigCodec
import com.dsbuilder.frontend.cli.feature.components.presentation.ComponentsCliCommand
import com.dsbuilder.frontend.cli.feature.components.presentation.ComponentsPushCliCommand
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для feature `components`.
 */
public fun componentsFeatureModule(): Module = module {
    single { ConfigCodec() }
    single<ComponentPackageLoader> {
        DefaultComponentPackageLoader(fileSystem = get<CliFileSystem>())
    }
    single<ComponentConfigRemoteSource> {
        HttpComponentConfigRemoteSource(httpClientFactory = get<AuthenticatedHttpClientFactory>())
    }
    single {
        PushComponentsUseCase(
            projectContextReader = get<ProjectContextReader>(),
            projectApiKeyProvider = get<ProjectApiKeyProvider>(),
            apiUrlResolver = get<ApiUrlResolver>(),
            componentPackageLoader = get<ComponentPackageLoader>(),
            remoteSource = get<ComponentConfigRemoteSource>(),
            codec = get<ConfigCodec>(),
        )
    }
    single { ComponentsPushCliCommand(get<PushComponentsUseCase>()) }
    single { ComponentsCliCommand(get<ComponentsPushCliCommand>()) }
    single<CliktCommand> { get<ComponentsCliCommand>() }
}
