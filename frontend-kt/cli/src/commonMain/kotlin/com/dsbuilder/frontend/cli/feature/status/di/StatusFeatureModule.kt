package com.dsbuilder.frontend.cli.feature.status.di

import com.dsbuilder.frontend.cli.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.cli.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.cli.core.application.ProjectContextReader
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.cli.feature.status.application.CheckProjectStatusUseCase
import com.dsbuilder.frontend.cli.feature.status.application.ProjectAccessVerifier
import com.dsbuilder.frontend.cli.feature.status.data.HttpProjectAccessVerifier
import com.dsbuilder.frontend.cli.feature.status.presentation.StatusCliCommand
import com.github.ajalt.clikt.core.CliktCommand
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для feature `status`.
 */
public fun statusFeatureModule(): Module = module {
    single<ProjectAccessVerifier> { HttpProjectAccessVerifier(get<AuthenticatedHttpClientFactory>()) }
    single {
        CheckProjectStatusUseCase(
            projectContextReader = get<ProjectContextReader>(),
            projectApiKeyProvider = get<ProjectApiKeyProvider>(),
            projectApiUrlProvider = get<ProjectApiUrlProvider>(),
            projectAccessVerifier = get<ProjectAccessVerifier>(),
        )
    }
    single {
        StatusCliCommand(
            checkProjectStatusUseCase = get<CheckProjectStatusUseCase>(),
        )
    }
    single<CliktCommand> { get<StatusCliCommand>() }
}
