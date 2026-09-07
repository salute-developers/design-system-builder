package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.platform.PlatformCapabilityRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.ComponentConfigRemoteSource
import com.dsbuilder.frontend.feature.components.application.ComponentPackageDirectoryReader
import com.dsbuilder.frontend.feature.components.application.ComponentPackageLoader
import com.dsbuilder.frontend.feature.components.application.FetchComponentsUseCase
import com.dsbuilder.frontend.feature.components.application.GenerateComponentsUseCase
import com.dsbuilder.frontend.feature.components.application.LocalComponentPackageWriter
import com.dsbuilder.frontend.feature.components.application.PushComponentsUseCase
import com.dsbuilder.frontend.feature.components.data.DefaultComponentPackageLoader
import com.dsbuilder.frontend.feature.components.data.HttpComponentConfigRemoteSource
import com.dsbuilder.frontend.feature.components.data.LocalComponentPackageDirectoryReader
import com.dsbuilder.frontend.feature.components.data.LocalComponentPackageFileWriter
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageWritePlanBuilder
import com.dsbuilder.frontend.feature.components.domain.codec.ConfigCodec
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для прикладного слоя фичи `components`.
 */
public fun componentsApplicationModule(): Module = module {
    single { ConfigCodec() }
    single<ComponentPackageLoader> {
        DefaultComponentPackageLoader(fileSystem = get<WorkspaceFileSystem>())
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
    single<ComponentPackageDirectoryReader> {
        LocalComponentPackageDirectoryReader(fileSystem = get<WorkspaceFileSystem>())
    }
    single<LocalComponentPackageWriter> {
        LocalComponentPackageFileWriter(fileSystem = get<WorkspaceFileSystem>())
    }
    single { ComponentPackageWritePlanBuilder() }
    single {
        FetchComponentsUseCase(
            projectContextReader = get<ProjectContextReader>(),
            projectApiKeyProvider = get<ProjectApiKeyProvider>(),
            apiUrlResolver = get<ApiUrlResolver>(),
            remoteSource = get<ComponentConfigRemoteSource>(),
            directoryReader = get<ComponentPackageDirectoryReader>(),
            writer = get<LocalComponentPackageWriter>(),
            codec = get<ConfigCodec>(),
            planBuilder = get<ComponentPackageWritePlanBuilder>(),
        )
    }
    single { GenerateComponentsUseCase(get<PlatformCapabilityRunner>()) }
}
