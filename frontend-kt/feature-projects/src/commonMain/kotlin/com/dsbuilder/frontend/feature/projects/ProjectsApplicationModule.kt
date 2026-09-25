package com.dsbuilder.frontend.feature.projects

import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.feature.projects.application.ListProjectsUseCase
import com.dsbuilder.frontend.feature.projects.application.ProjectsClient
import com.dsbuilder.frontend.feature.projects.data.HttpProjectsClient
import org.koin.core.module.Module
import org.koin.dsl.module

/**
 * Создает Koin module для прикладного слоя фичи `projects`.
 */
public fun projectsApplicationModule(): Module = module {
    single<ProjectsClient> { HttpProjectsClient(get<AuthenticatedHttpClientFactory>()) }
    single {
        ListProjectsUseCase(
            apiUrlResolver = get<ApiUrlResolver>(),
            sessionResolver = get<UserSessionCredentialResolver>(),
            projectsClient = get<ProjectsClient>(),
        )
    }
}
