package com.dsbuilder.identity.auth.di

import com.dsbuilder.identity.auth.application.GatewayAuthorizer
import com.dsbuilder.identity.auth.application.port.JwtVerifier
import com.dsbuilder.identity.auth.application.port.PersonalAccessTokenResult
import com.dsbuilder.identity.auth.application.port.PersonalAccessTokenVerifier
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.application.usecase.AuthorizeProjectRequestUseCase
import com.dsbuilder.identity.auth.application.usecase.AuthorizeUserRequestUseCase
import com.dsbuilder.identity.auth.application.usecase.DefaultGatewayAuthorizer
import com.dsbuilder.identity.auth.data.AllowAuthenticatedProjectContextResolver
import com.dsbuilder.identity.auth.data.HttpProjectContextResolver
import com.dsbuilder.identity.auth.data.KeycloakJwtVerifier
import com.dsbuilder.identity.auth.data.ProjectAccessConfiguration
import com.dsbuilder.identity.auth.data.authConfiguration
import io.ktor.server.config.ApplicationConfig
import org.koin.dsl.module

/** Собирает dependency graph Auth Helper. */
fun authModule(applicationConfig: ApplicationConfig, externalProjectAccess: Boolean = false) = module {
    val configuration = applicationConfig.authConfiguration()

    single<GatewayAuthorizer> {
        DefaultGatewayAuthorizer(get(), get())
    }
    single<JwtVerifier> { KeycloakJwtVerifier(get()) }
    single { configuration }
    if (!externalProjectAccess) {
        single<ProjectContextResolver> {
            when (val projectAccess = configuration.projectAccess) {
                is ProjectAccessConfiguration.AllowAuthenticated -> {
                    AllowAuthenticatedProjectContextResolver(projectAccess.role)
                }
                is ProjectAccessConfiguration.Http -> HttpProjectContextResolver(projectAccess)
            }
        }
    }
    single {
        AuthorizeProjectRequestUseCase(
            jwtVerifier = get(),
            projectContextResolver = get(),
            personalTokens = getOrNull() ?: PersonalAccessTokenVerifier {
                PersonalAccessTokenResult.Invalid
            },
        )
    }
    single {
        AuthorizeUserRequestUseCase(
            jwtVerifier = get(),
            personalTokens = getOrNull() ?: PersonalAccessTokenVerifier {
                PersonalAccessTokenResult.Invalid
            },
        )
    }
}
