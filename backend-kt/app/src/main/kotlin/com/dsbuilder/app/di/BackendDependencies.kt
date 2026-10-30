package com.dsbuilder.app.di

import com.dsbuilder.app.data.InProcessProjectContext
import com.dsbuilder.app.data.InProcessProjectKey
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.app.DsServiceConfiguration
import com.dsbuilder.ds.app.dsDependencyModules
import com.dsbuilder.identity.auth.application.port.ProjectAccessKeyVerifier
import com.dsbuilder.identity.auth.application.port.ProjectContextResolver
import com.dsbuilder.identity.auth.di.authModule
import com.dsbuilder.projects.app.projectsDependencyModules
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
    ds: com.dsbuilder.ds.app.DsRuntime,
) {
    val projectsConfiguration = requireNotNull(YamlConfig("dsbuilder/projects/defaults.yaml"))
    val authConfiguration = requireNotNull(YamlConfig("dsbuilder/identity/defaults.yaml"))
    install(Koin) {
        allowOverride(false)
        modules(
            listOf(
                module {
                    single { evaluator }
                    single<com.dsbuilder.projects.feature.projects.application.port.DesignSystemCounts> {
                        com.dsbuilder.app.data.InProcessDesignSystemCounts(get())
                    }
                    single<ProjectContextResolver> { InProcessProjectContext(get()) }
                    single<ProjectAccessKeyVerifier> { InProcessProjectKey(get()) }
                },
            ) + dsDependencyModules(dsConfiguration, ds, registerSharedPolicy = false) +
                projectsDependencyModules(projectsConfiguration, evaluator) +
                authModule(authConfiguration, externalProjectAccess = true),
        )
    }
}
