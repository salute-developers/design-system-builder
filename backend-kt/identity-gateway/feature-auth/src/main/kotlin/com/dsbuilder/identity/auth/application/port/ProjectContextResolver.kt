package com.dsbuilder.identity.auth.application.port

/** Данные аутентифицированного пользователя, необходимые для проверки доступа к проекту. */
data class ProjectActorContext(
    /** Идентификатор пользователя Identity Provider. */
    val userId: String,
    /** Обладает ли пользователь глобальными правами администратора. */
    val isSystemAdmin: Boolean,
)

/** Разрешённый контекст проекта без transport-specific типов. */
data class ResolvedProjectContext(
    /** Идентификатор проекта. */
    val projectId: String,
    /** Effective role пользователя в проекте. */
    val projectRole: String,
)

/** Порт проверки пользовательского доступа к проекту. */
interface ProjectContextResolver {
    /** Возвращает effective project context для аутентифицированного пользователя. */
    suspend fun resolve(actor: ProjectActorContext, projectId: String): ProjectContextResolution
}

/** Результат проверки пользовательского доступа к проекту. */
sealed interface ProjectContextResolution {
    /** Доступ разрешён с вычисленным project context. */
    data class Allowed(
        /** Вычисленный project context. */ val context: ResolvedProjectContext,
    ) : ProjectContextResolution

    /** Доступ запрещён бизнес-правилами. */
    data object Denied : ProjectContextResolution

    /** Проверка временно недоступна. */
    data object Unavailable : ProjectContextResolution
}
