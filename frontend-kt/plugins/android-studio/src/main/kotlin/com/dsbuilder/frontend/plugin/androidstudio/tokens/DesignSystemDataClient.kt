package com.dsbuilder.frontend.plugin.androidstudio.tokens

/** Порт чтения дизайн-систем, токенов и значений токенов проекта. */
public interface DesignSystemDataClient {
    /** Дизайн-системы, видимые в рамках проекта (`GET /api/projects/{id}/ds/design-systems`). */
    public suspend fun listDesignSystems(projectId: String): List<DesignSystem>

    /** Токены проекта, без значений (`GET /api/projects/{id}/ds/tokens`). */
    public suspend fun listTokens(projectId: String): List<DesignToken>

    /** Значения токенов проекта, по всем платформам (`GET /api/projects/{id}/ds/token-values`). */
    public suspend fun listTokenValues(projectId: String): List<TokenValue>
}
