package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.ApiKeyResolver
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.process.ProcessRunner
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
    single<ProcessRunner> { get<ClientRuntime>().processRunner }
    single<CredentialStore> { get<ClientRuntime>().credentialStore }
    single<TokenClient> { get<ClientRuntime>().tokenClient }
    single { ProjectConfigStore(get<WorkspaceFileSystem>()) }
    single { ApiKeyResolver(get<EnvironmentReader>()) }
    single { ApiUrlResolver(get<EnvironmentReader>()) }
    single<ContextSource> { NearestProjectConfigContextSource(get<ProjectConfigStore>()) }
    single { ContextResolver(getAll<ContextSource>()) }
    single<ProjectContextReader> { LocalProjectContextReader(get<ContextResolver>()) }
    single<ProjectApiKeyProvider> { RuntimeProjectApiKeyProvider(get<ApiKeyResolver>()) }
    single<ProjectApiUrlProvider> { RuntimeProjectApiUrlProvider(get<ApiUrlResolver>()) }
    single<CredentialProvider> {
        RuntimeCredentialProvider(
            apiKeyResolver = get<ApiKeyResolver>(),
            credentialStore = get<CredentialStore>(),
            tokenClient = get<TokenClient>(),
        )
    }
}
