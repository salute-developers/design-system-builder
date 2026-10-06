package com.dsbuilder.frontend.feature.projects.application

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver

/**
 * Возвращает проекты, доступные авторизованному пользователю. Не требует уже разрешённого
 * `ProjectContext` — список нужен как раз для того, чтобы такой контекст выбрать.
 */
public class ListProjectsUseCase(
    private val apiUrlResolver: ApiUrlResolver,
    private val sessionResolver: UserSessionCredentialResolver,
    private val projectsClient: ProjectsClient,
) {
    /**
     * Выполняет сценарий.
     *
     * @param apiUrlOverride опциональный override backend API URL.
     */
    public suspend fun execute(apiUrlOverride: String? = null): ProjectsReadResult {
        val accessToken = sessionResolver.currentAccessToken()
            ?: return ProjectsReadResult.Failed(
                ProjectsReadErrorCode.AUTH_REQUIRED,
                "Error: user session is not configured.",
            )
        val apiUrl = apiUrlResolver.resolve(apiUrlOverride).value
        return projectsClient.listProjects(apiUrl, BackendCredential.Bearer(accessToken))
    }
}
