package com.dsbuilder.app.di

import com.dsbuilder.app.data.InProcessDesignSystemCounts
import com.dsbuilder.app.data.InProcessProjectContext
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.app.DsRuntime
import com.dsbuilder.ds.app.DsServiceConfiguration
import com.dsbuilder.ds.app.dsDependencyModules
import com.dsbuilder.identity.auth.application.port.PersonalAccessTokenResult
import com.dsbuilder.identity.auth.application.port.PersonalAccessTokenVerifier
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.di.authModule
import com.dsbuilder.projects.app.projectsDependencyModules
import com.dsbuilder.projects.feature.projects.application.port.DesignSystemCounts
import com.dsbuilder.settings.application.PersonalAccessTokenVerification
import com.dsbuilder.settings.di.UserSettingsModule
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.config.yaml.YamlConfig
import io.ktor.server.routing.get
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin

/** Устанавливает единый граф с общей политикой и закрытыми реализациями подсистем. */
fun Application.installBackendDependencies(
    evaluator: PolicyEvaluator,
    dsConfiguration: DsServiceConfiguration,
    ds: DsRuntime,
) {
    val projectsConfiguration = requireNotNull(YamlConfig("dsbuilder/projects/defaults.yaml"))
    val authConfiguration = requireNotNull(YamlConfig("dsbuilder/identity/defaults.yaml"))
    install(Koin) {
        allowOverride(false)
        modules(
            listOf(
                module {
                    single { evaluator }
                    single { UserSettingsModule(projectsConfiguration, evaluator) }
                    single<PersonalAccessTokenVerifier> {
                        val tokens = get<UserSettingsModule>().tokens
                        PersonalAccessTokenVerifier { secret ->
                            when (val verified = tokens.verify(secret)) {
                                is PersonalAccessTokenVerification.Valid -> {
                                    val token = verified.token
                                    PersonalAccessTokenResult.Valid(
                                        token.tokenId, token.userId, token.scopes, token.systemAdmin,
                                    )
                                }
                                PersonalAccessTokenVerification.Invalid ->
                                    PersonalAccessTokenResult.Invalid
                                PersonalAccessTokenVerification.Unavailable ->
                                    PersonalAccessTokenResult.Unavailable
                            }
                        }
                    }
                    single<DesignSystemCounts> {
                        InProcessDesignSystemCounts(get())
                    }
                    single<ProjectContextResolver> { InProcessProjectContext(get()) }
                },
            ) + dsDependencyModules(dsConfiguration, ds, registerSharedPolicy = false) +
                projectsDependencyModules(projectsConfiguration, evaluator) +
                authModule(authConfiguration, externalProjectAccess = true),
        )
    }
}
