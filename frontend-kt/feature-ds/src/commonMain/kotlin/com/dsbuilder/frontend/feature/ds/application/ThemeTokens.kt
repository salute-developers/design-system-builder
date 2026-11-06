package com.dsbuilder.frontend.feature.ds.application

import com.dsbuilder.frontend.core.auth.BackendCredential

/** Тема дизайн-системы, для которой читаются токены.
 * @property projectId проект.
 * @property designSystemId дизайн-система.
 * @property tenantId тема.
 */
public data class ThemeContext(
    public val projectId: String,
    public val designSystemId: String,
    public val tenantId: String,
)

/** Чтения токенов темы на границе версии. Успешный ответ сохраняет JSON бэкенда: у значений нет единой схемы. */
public interface ThemeTokensClient {
    /** Опубликованные версии дизайн-системы. */
    public suspend fun versions(
        apiUrl: String,
        credential: BackendCredential,
        projectId: String,
        designSystemId: String,
    ): ModelReadResult

    /**
     * Определения, значения цветов, типографика и размеры темы: объект с полями `tokens`, `values`,
     * `typography` и `sizes`. Без [versionId] читается активный черновик.
     */
    public suspend fun tokens(
        apiUrl: String,
        credential: BackendCredential,
        context: ThemeContext,
        versionId: String?,
    ): ModelReadResult
}
