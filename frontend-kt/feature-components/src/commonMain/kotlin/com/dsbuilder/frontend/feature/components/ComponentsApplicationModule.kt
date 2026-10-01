package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.platform.PlatformCapabilityRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.ApiMetaRemoteSource
import com.dsbuilder.frontend.feature.components.application.ApiMetaSource
import com.dsbuilder.frontend.feature.components.application.ComponentConfigRemoteSource
import com.dsbuilder.frontend.feature.components.application.ComponentConfigsSnapshotSource
import com.dsbuilder.frontend.feature.components.application.ComponentConfigsSnapshotWriter
import com.dsbuilder.frontend.feature.components.application.ComponentPackageDirectoryReader
import com.dsbuilder.frontend.feature.components.application.ComponentPackageLoader
import com.dsbuilder.frontend.feature.components.application.ComponentReadRemoteSource
import com.dsbuilder.frontend.feature.components.application.ComponentReadUseCases
import com.dsbuilder.frontend.feature.components.application.FetchComponentsUseCase
import com.dsbuilder.frontend.feature.components.application.GenerateComponentsUseCase
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaUseCase
import com.dsbuilder.frontend.feature.components.application.LocalComponentPackageWriter
import com.dsbuilder.frontend.feature.components.application.PushComponentsUseCase
import com.dsbuilder.frontend.feature.components.data.DefaultComponentPackageLoader
import com.dsbuilder.frontend.feature.components.data.HttpApiMetaRemoteSource
import com.dsbuilder.frontend.feature.components.data.HttpComponentConfigRemoteSource
import com.dsbuilder.frontend.feature.components.data.HttpComponentConfigsSnapshotSource
import com.dsbuilder.frontend.feature.components.data.HttpComponentReadRemoteSource
import com.dsbuilder.frontend.feature.components.data.LocalComponentConfigsSnapshotWriter
import com.dsbuilder.frontend.feature.components.data.LocalComponentPackageDirectoryReader
import com.dsbuilder.frontend.feature.components.data.LocalComponentPackageFileWriter
import com.dsbuilder.frontend.feature.components.data.PlatformApiMetaSource
import com.dsbuilder.frontend.feature.components.domain.ComponentPackageWritePlanBuilder
import com.dsbuilder.frontend.feature.components.domain.apimeta.ComposeApiMetaNormalizer
import com.dsbuilder.frontend.feature.components.domain.apimeta.ViewApiMetaNormalizer
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
    single<ComponentReadRemoteSource> { HttpComponentReadRemoteSource(get(), get()) }
    single { ComponentReadUseCases(get(), get(), get(), get()) }
    single {
        PushComponentsUseCase(
            projectContextReader = get<ProjectContextReader>(),
            credentialProvider = get<CredentialProvider>(),
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
    single<ComponentConfigsSnapshotSource> { HttpComponentConfigsSnapshotSource(get<AuthenticatedHttpClientFactory>()) }
    single<ComponentConfigsSnapshotWriter> { LocalComponentConfigsSnapshotWriter(get<WorkspaceFileSystem>()) }
    single { ComponentPackageWritePlanBuilder() }
    single {
        FetchComponentsUseCase(
            projectContextReader = get<ProjectContextReader>(),
            credentialProvider = get<CredentialProvider>(),
            apiUrlResolver = get<ApiUrlResolver>(),
            remoteSource = get<ComponentConfigRemoteSource>(),
            directoryReader = get<ComponentPackageDirectoryReader>(),
            writer = get<LocalComponentPackageWriter>(),
            codec = get<ConfigCodec>(),
            planBuilder = get<ComponentPackageWritePlanBuilder>(),
            snapshotSource = get<ComponentConfigsSnapshotSource>(),
            snapshotWriter = get<ComponentConfigsSnapshotWriter>(),
        )
    }
    single { GenerateComponentsUseCase(get<PlatformCapabilityRunner>()) }
    apiMetaBindings()
}

/**
 * Связывает импорт API-меты: источник меты, HTTP-адаптер и use case команды `components import-api`.
 */
private fun Module.apiMetaBindings() {
    single { ComposeApiMetaNormalizer() }
    single { ViewApiMetaNormalizer() }
    single<ApiMetaSource> {
        PlatformApiMetaSource(
            platformCapabilityRunner = get<PlatformCapabilityRunner>(),
            fileSystem = get<WorkspaceFileSystem>(),
        )
    }
    single<ApiMetaRemoteSource> { HttpApiMetaRemoteSource(get<AuthenticatedHttpClientFactory>()) }
    single {
        ImportApiMetaUseCase(
            projectContextReader = get<ProjectContextReader>(),
            credentialProvider = get<CredentialProvider>(),
            apiUrlResolver = get<ApiUrlResolver>(),
            metaSource = get<ApiMetaSource>(),
            remoteSource = get<ApiMetaRemoteSource>(),
            normalizers = mapOf(
                TargetPlatform.COMPOSE to get<ComposeApiMetaNormalizer>(),
                TargetPlatform.ANDROID_VIEW to get<ViewApiMetaNormalizer>(),
            ),
        )
    }
}
