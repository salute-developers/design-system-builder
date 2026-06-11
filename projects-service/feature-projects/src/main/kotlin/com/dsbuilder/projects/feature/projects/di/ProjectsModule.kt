package com.dsbuilder.projects.feature.projects.di

import com.dsbuilder.projects.feature.projects.application.port.AccessKeySecretManager
import com.dsbuilder.projects.feature.projects.application.port.IdentityUserLookup
import com.dsbuilder.projects.feature.projects.application.port.ProjectRepository
import com.dsbuilder.projects.feature.projects.application.port.TransactionManager
import com.dsbuilder.projects.feature.projects.application.usecase.AddProjectMemberUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ArchiveProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.CreateProjectAccessKeyUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.CreateProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.GetEffectiveProjectRoleUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.GetProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectAccessKeysUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectMembersUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ListProjectsUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.ProjectAccessPolicy
import com.dsbuilder.projects.feature.projects.application.usecase.RemoveProjectMemberUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.RestoreProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.RevokeProjectAccessKeyUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.UpdateProjectMemberRoleUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.UpdateProjectUseCase
import com.dsbuilder.projects.feature.projects.application.usecase.VerifyProjectAccessKeyUseCase
import com.dsbuilder.projects.feature.projects.data.keycloak.KeycloakIdentityUserLookup
import com.dsbuilder.projects.feature.projects.data.keycloak.keycloakIdentityLookupConfiguration
import com.dsbuilder.projects.feature.projects.data.local.ExposedProjectRepository
import com.dsbuilder.projects.feature.projects.data.local.Pbkdf2AccessKeySecretManager
import com.dsbuilder.projects.feature.projects.data.local.accessKeyConfiguration
import com.dsbuilder.projects.feature.projects.data.local.db.JdbcTransactionManager
import com.dsbuilder.projects.feature.projects.data.local.db.ProjectAccessKeysTable
import com.dsbuilder.projects.feature.projects.data.local.db.ProjectMembersTable
import com.dsbuilder.projects.feature.projects.data.local.db.ProjectsTable
import io.ktor.server.config.ApplicationConfig
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.koin.dsl.module
import java.time.Clock

/** Описывает dependency graph для feature-модуля Projects. */
object ProjectsModule {
    /** Регистрирует Koin bindings для use case'ов проектов, участников и access-check. */
    val beans = module {
        single<Clock> { Clock.systemUTC() }
        single { ProjectAccessPolicy() }
        single { get<ApplicationConfig>().keycloakIdentityLookupConfiguration() }
        single { get<ApplicationConfig>().accessKeyConfiguration() }
        single<IdentityUserLookup> { KeycloakIdentityUserLookup(get()) }
        single<AccessKeySecretManager> { Pbkdf2AccessKeySecretManager(get()) }
        single<ProjectRepository> { ExposedProjectRepository() }
        single<TransactionManager> { JdbcTransactionManager(get()) }
        single { CreateProjectUseCase(get(), get(), get(), get()) }
        single { ListProjectsUseCase(get(), get()) }
        single { GetProjectUseCase(get(), get(), get()) }
        single { UpdateProjectUseCase(get(), get(), get(), get()) }
        single { ArchiveProjectUseCase(get(), get(), get(), get()) }
        single { RestoreProjectUseCase(get(), get(), get(), get()) }
        single { ListProjectMembersUseCase(get(), get(), get()) }
        single { AddProjectMemberUseCase(get(), get(), get(), get(), get()) }
        single { UpdateProjectMemberRoleUseCase(get(), get(), get(), get()) }
        single { RemoveProjectMemberUseCase(get(), get(), get()) }
        single { CreateProjectAccessKeyUseCase(get(), get(), get(), get(), get(), get()) }
        single { ListProjectAccessKeysUseCase(get(), get(), get()) }
        single { RevokeProjectAccessKeyUseCase(get(), get(), get(), get()) }
        single { VerifyProjectAccessKeyUseCase(get(), get(), get(), get(), get(), get()) }
        single { GetEffectiveProjectRoleUseCase(get(), get(), get()) }
    }

    /** Создает или обновляет схему базы данных, необходимую для feature Projects. */
    fun createSchema() {
        SchemaUtils.create(ProjectsTable, ProjectMembersTable, ProjectAccessKeysTable)
    }
}
