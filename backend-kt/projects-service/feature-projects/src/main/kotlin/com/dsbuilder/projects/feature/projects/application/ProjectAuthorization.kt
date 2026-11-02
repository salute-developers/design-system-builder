package com.dsbuilder.projects.feature.projects.application

/** Прикладной контракт авторизации без доступа к моделям хранения. */
interface ProjectAuthorization {
    /** Возвращает эффективную роль или отсутствие доступа. */
    suspend fun role(userId: String, projectId: String, systemAdmin: Boolean): String?

    /** Проверяет ключ, включая отзыв, срок действия и обновление времени использования. */
    suspend fun verify(token: String): VerifiedProjectKey?
}
