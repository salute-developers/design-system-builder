package com.dsbuilder.identity.auth.di

import com.dsbuilder.identity.auth.application.port.JwtVerifier
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerifier
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.application.usecase.AuthorizeProjectRequestUseCase
import com.dsbuilder.identity.auth.application.usecase.AuthorizeUserRequestUseCase
import com.dsbuilder.identity.auth.data.AllowAuthenticatedProjectContextResolver
import com.dsbuilder.identity.auth.data.HttpProjectAccessKeyVerifier
import com.dsbuilder.identity.auth.data.HttpProjectContextResolver
import com.dsbuilder.identity.auth.data.KeycloakJwtVerifier
import com.dsbuilder.identity.auth.data.ProjectAccessConfiguration
import com.dsbuilder.identity.auth.data.authConfiguration
import io.ktor.server.config.ApplicationConfig
import org.koin.dsl.module

/** Собирает dependency graph Auth Helper. */
fun authModule(applicationConfig: ApplicationConfig) = module {
    val configuration = applicationConfig.authConfiguration()

    single<JwtVerifier> { KeycloakJwtVerifier(get()) }
    single { configuration }
    single<ProjectContextResolver> {
        when (val projectAccess = configuration.projectAccess) {
            is ProjectAccessConfiguration.AllowAuthenticated -> {
                AllowAuthenticatedProjectContextResolver(projectAccess.role)
            }
            is ProjectAccessConfiguration.Http -> HttpProjectContextResolver(projectAccess)
        }
    }
    single<ProjectAccessKeyVerifier> {
        when (val projectAccess = configuration.projectAccess) {
            is ProjectAccessConfiguration.AllowAuthenticated -> {
                error("Project access key verifier is unavailable in allow-authenticated mode")
            }
            is ProjectAccessConfiguration.Http -> HttpProjectAccessKeyVerifier(projectAccess)
        }
    }
    single {
        AuthorizeProjectRequestUseCase(
            jwtVerifier = get(),
            projectContextResolver = get(),
            projectAccessKeyVerifier = get(),
        )
    }
    single {
        AuthorizeUserRequestUseCase(
            jwtVerifier = get(),
        )
    }
}
