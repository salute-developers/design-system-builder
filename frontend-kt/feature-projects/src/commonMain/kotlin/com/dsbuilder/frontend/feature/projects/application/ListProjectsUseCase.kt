package com.dsbuilder.frontend.feature.projects.application

import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.application.UserSessionAccess
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver

/**
 * Возвращает проекты, доступные авторизованному пользователю. Не требует уже разрешённого
 * `ProjectContext` — список нужен как раз для того, чтобы такой контекст выбрать.
 */
public class ListProjectsUseCase(
    private val apiUrlResolver: ApiUrlResolver,
    private val sessionResolver: UserSessionAccess,
    private val projectsClient: ProjectsClient,
) {
    /** Совместимый конструктор для активной IDE-сессии. */
    public constructor(
        apiUrlResolver: ApiUrlResolver,
        sessionResolver: UserSessionCredentialResolver,
        projectsClient: ProjectsClient,
    ) :
        this(apiUrlResolver, UserSessionAccess(sessionResolver), projectsClient)

    /**
     * Выполняет сценарий.
     *
     * @param apiUrlOverride опциональный override backend API URL.
     */
    public suspend fun execute(apiUrlOverride: String? = null, credentialEnvName: String? = null): ProjectsReadResult {
        val apiUrl = apiUrlResolver.resolve(apiUrlOverride).value
        return when (val access = sessionResolver.resolve(apiUrl, credentialEnvName)) {
            is CredentialResult.Selected -> projectsClient.listProjects(apiUrl, access.credential)
            is CredentialResult.Failed -> ProjectsReadResult.Failed(
                PROJECT_SESSION_FAILURES[access.code] ?: ProjectsReadErrorCode.BACKEND_UNAVAILABLE,
                if (access.code == AuthErrorCode.AUTH_REQUIRED) {
                    "Cannot authorize discovery. Run dsbuilder auth login and retry."
                } else {
                    "Cannot authorize discovery: ${access.code}."
                },
            )
        }
    }
}

private val PROJECT_SESSION_FAILURES = mapOf(
    AuthErrorCode.PAT_INVALID to ProjectsReadErrorCode.PAT_INVALID,
    AuthErrorCode.AUTH_REQUIRED to ProjectsReadErrorCode.AUTH_REQUIRED,
    AuthErrorCode.FORBIDDEN to ProjectsReadErrorCode.FORBIDDEN,
)
