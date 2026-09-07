package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.ApiKeyResolver
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для общих прикладных зависимостей клиента DS Builder.
 */
public fun coreApplicationModule(runtime: ClientRuntime): Module = module {
    single<ClientRuntime> { runtime }
    single<WorkspaceFileSystem> { get<ClientRuntime>().fileSystem }
    single<EnvironmentReader> { get<ClientRuntime>().environmentReader }
    single<AuthenticatedHttpClientFactory> { get<ClientRuntime>().httpClientFactory }
    single { ProjectConfigStore(get<WorkspaceFileSystem>()) }
    single { ApiKeyResolver(get<EnvironmentReader>()) }
    single { ApiUrlResolver(get<EnvironmentReader>()) }
    single<ProjectContextReader> { LocalProjectContextReader(get<ProjectConfigStore>()) }
    single<ProjectApiKeyProvider> { RuntimeProjectApiKeyProvider(get<ApiKeyResolver>()) }
    single<ProjectApiUrlProvider> { RuntimeProjectApiUrlProvider(get<ApiUrlResolver>()) }
}
