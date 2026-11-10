package com.dsbuilder.frontend.plugin.androidstudio.tokens

/** Порт чтения дизайн-систем, токенов и значений токенов проекта. */
public interface DesignSystemDataClient {
    /** Токены проекта, без значений (`GET /api/projects/{id}/design-systems/{designSystemId}/tokens`). */
    public suspend fun listTokens(projectId: String, designSystemId: String): List<DesignToken>

    /** Значения токенов проекта, по всем платформам (`GET /api/projects/{id}/design-systems/{designSystemId}/token-values`). */
    public suspend fun listTokenValues(projectId: String, designSystemId: String): List<TokenValue>
}
