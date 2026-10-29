package com.dsbuilder.frontend.feature.projects.application

import com.dsbuilder.frontend.core.auth.BackendCredential

/**
 * Проект DS Builder, в котором пользователь состоит участником.
 *
 * @property id идентификатор проекта.
 * @property name имя проекта.
 * @property description описание проекта, если задано.
 */
public data class Project(
    public val id: String,
    public val name: String,
    public val description: String?,
)

/**
 * Stable error category для отказа получения списка проектов.
 */
public enum class ProjectsReadErrorCode {
    /** Пользовательская сессия отсутствует или невалидна. */
    AUTH_REQUIRED,

    /** Backend недоступен или вернул неожиданный ответ. */
    BACKEND_UNAVAILABLE,
}

/**
 * Результат получения списка проектов пользователя.
 */
public sealed interface ProjectsReadResult {
    /**
     * Проекты успешно получены. Пустой список — легитимный результат, а не ошибка.
     *
     * @property projects проекты, где пользователь состоит участником.
     */
    public data class Success(
        public val projects: List<Project>,
    ) : ProjectsReadResult

    /**
     * Получение списка завершилось ошибкой.
     *
     * @property code stable machine-readable failure category.
     * @property message user-facing ошибка.
     */
    public data class Failed(
        public val code: ProjectsReadErrorCode,
        public val message: String,
    ) : ProjectsReadResult
}

/**
 * Port получения проектов, доступных авторизованному пользователю. `public`, а не `internal`:
 * помимо Koin-графа `:cli`, use case напрямую конструирует и non-Koin composition root
 * (`:plugins:android-studio`'s `PluginServices` — plain object, без DI-контейнера).
 */
public fun interface ProjectsClient {
    /**
     * Возвращает проекты, где пользователь состоит участником (`GET /api/projects`).
     */
    public suspend fun listProjects(apiUrl: String, credential: BackendCredential): ProjectsReadResult
}
