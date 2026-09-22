package com.dsbuilder.frontend.feature.status.application

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectId

/**
 * Port проверки доступа к project.
 */
internal fun interface ProjectAccessVerifier {
    /**
     * Проверяет, что API key авторизует доступ к project.
     */
    suspend fun verify(check: ProjectAccessCheck): ProjectAccessResult
}

/**
 * Credential-aware access check for project status.
 */
internal data class ProjectAccessCheck(
    val projectId: ProjectId,
    val designSystemId: DesignSystemId,
    val apiUrl: ProjectApiUrl,
    val credential: BackendCredential,
)

/**
 * Результат проверки доступа к project и design system.
 */
internal sealed interface ProjectAccessResult {
    /**
     * Доступ подтвержден, project и design system найдены.
     *
     * @property projectName имя project из backend response.
     * @property designSystemName имя design system из backend response.
     */
    data class Authorized(
        val projectName: String,
        val designSystemName: String,
    ) : ProjectAccessResult

    /**
     * Доступ не подтвержден.
     *
     * @property message user-facing ошибка.
     * @property code stable status error category.
     */
    data class Failed(
        val message: String,
        val code: CheckProjectStatusErrorCode = CheckProjectStatusErrorCode.BACKEND_UNAVAILABLE,
    ) : ProjectAccessResult
}
