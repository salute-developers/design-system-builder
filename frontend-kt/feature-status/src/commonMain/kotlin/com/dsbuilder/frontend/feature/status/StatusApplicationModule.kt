package com.dsbuilder.frontend.feature.status

import com.dsbuilder.frontend.core.application.ProjectApiKeyProvider
import com.dsbuilder.frontend.core.application.ProjectApiUrlProvider
import com.dsbuilder.frontend.core.application.ProjectContextReader
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusUseCase
import com.dsbuilder.frontend.feature.status.application.ProjectAccessVerifier
import com.dsbuilder.frontend.feature.status.data.HttpProjectAccessVerifier
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для прикладного слоя фичи `status`.
 */
public fun statusApplicationModule(): Module = module {
    single<ProjectAccessVerifier> { HttpProjectAccessVerifier(get<AuthenticatedHttpClientFactory>()) }
    single {
        CheckProjectStatusUseCase(
            projectContextReader = get<ProjectContextReader>(),
            projectApiKeyProvider = get<ProjectApiKeyProvider>(),
            projectApiUrlProvider = get<ProjectApiUrlProvider>(),
            projectAccessVerifier = get<ProjectAccessVerifier>(),
        )
    }
}
