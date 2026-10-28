package com.dsbuilder.identity.auth.application.port

import com.dsbuilder.identity.auth.domain.model.AuthenticatedActor
import com.dsbuilder.identity.auth.domain.model.ProjectContext

/** Минимальный прикладной контракт проверки доступа к проекту. */
interface ProjectContextResolver {
    /** Результат или операция проверки доступа без раскрытия инфраструктуры. */
    suspend fun resolve(actor: AuthenticatedActor, projectId: String): ProjectContextResolution
}

/** Минимальный прикладной контракт проверки доступа к проекту. */
sealed interface ProjectContextResolution {
    /** Результат или операция проверки доступа без раскрытия инфраструктуры. */
    data class Allowed(/** Проверенный проектный контекст. */ val context: ProjectContext) : ProjectContextResolution

    /** Результат или операция проверки доступа без раскрытия инфраструктуры. */
    data object Denied : ProjectContextResolution

    /** Результат или операция проверки доступа без раскрытия инфраструктуры. */
    data object Unavailable : ProjectContextResolution
}
