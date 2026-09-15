package com.dsbuilder.frontend.plugin.androidstudio.projects

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

/** Порт получения проектов, доступных авторизованному пользователю. */
public interface ProjectsClient {
    /** Возвращает проекты, где пользователь состоит участником (`GET /api/projects`). */
    public suspend fun listProjects(): List<Project>
}

/**
 * Возвращает проекты, доступные авторизованному пользователю. Пустой список — легитимный
 * результат (пользователя ещё никуда не добавили), а не ошибка.
 */
public class ListProjectsUseCase(
    private val projectsClient: ProjectsClient,
) {
    /** Выполняет сценарий. */
    public suspend fun execute(): List<Project> = projectsClient.listProjects()
}
