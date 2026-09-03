package com.dsbuilder.frontend.cli.core.di

import com.dsbuilder.frontend.cli.CliRuntime
import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.cli.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.cli.core.application.ProjectContextReader
import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.config.ProjectConfigStore
import com.dsbuilder.frontend.cli.core.credentials.ApiKeyResolver
import com.dsbuilder.frontend.cli.core.credentials.EnvironmentReader
import com.dsbuilder.frontend.cli.core.data.LocalProjectContextReader
import com.dsbuilder.frontend.cli.core.data.RuntimeProjectApiKeyProvider
import com.dsbuilder.frontend.cli.core.data.RuntimeProjectApiUrlProvider
import com.dsbuilder.frontend.cli.core.http.ApiUrlResolver
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClientFactory
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для core CLI dependencies.
 */
public fun coreCliModule(runtime: CliRuntime): Module = module {
    single<CliRuntime> { runtime }
    single<CliFileSystem> { get<CliRuntime>().fileSystem }
    single<EnvironmentReader> { get<CliRuntime>().environmentReader }
    single<AuthenticatedHttpClientFactory> { get<CliRuntime>().httpClientFactory }
    single { ProjectConfigStore(get<CliFileSystem>()) }
    single { ApiKeyResolver(get<EnvironmentReader>()) }
    single { ApiUrlResolver(get<EnvironmentReader>()) }
    single<ProjectContextReader> { LocalProjectContextReader(get<ProjectConfigStore>()) }
    single<ProjectApiKeyProvider> { RuntimeProjectApiKeyProvider(get<ApiKeyResolver>()) }
    single<ProjectApiUrlProvider> { RuntimeProjectApiUrlProvider(get<ApiUrlResolver>()) }
}
