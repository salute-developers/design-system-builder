package com.dsbuilder.frontend.feature.status.application

import com.dsbuilder.frontend.core.domain.ProjectAccessCheck

/**
 * Port проверки доступа к project.
 */
internal fun interface ProjectAccessVerifier {
    /**
     * Проверяет, что API key авторизует доступ к project.
     */
    fun verify(check: ProjectAccessCheck): ProjectAccessResult
}

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
     */
    data class Failed(
        val message: String,
    ) : ProjectAccessResult
}
