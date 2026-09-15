package com.dsbuilder.frontend.plugin.androidstudio.tokens

/** Возвращает дизайн-системы, видимые в рамках выбранного проекта. */
public class ListDesignSystemsUseCase(
    private val client: DesignSystemDataClient,
) {
    /** Выполняет сценарий. */
    public suspend fun execute(projectId: String): List<DesignSystem> = client.listDesignSystems(projectId)
}

/**
 * Возвращает токены выбранной дизайн-системы вместе со значением для выбранной платформы,
 * склеивая `tokens` и `token-values` на клиенте — REST-контракт их не соединяет.
 */
public class GetDesignSystemTokensUseCase(
    private val client: DesignSystemDataClient,
) {
    /**
     * Выполняет сценарий: токены [designSystemId], со значением для [platform] и [mode], если
     * оно есть. Токен может не зависеть от темы (значение с `mode == null`) — такое значение
     * берём, только если нет отдельного значения именно под [mode].
     */
    public suspend fun execute(
        projectId: String,
        designSystemId: String,
        platform: TokenPlatform,
        mode: TokenMode,
    ): List<TokenWithValue> {
        val tokens = client.listTokens(projectId).filter { it.designSystemId == designSystemId }
        val values = client.listTokenValues(projectId)
            .filter { it.platform == platform && (it.mode == null || it.mode == mode) }
            .groupBy { it.tokenId }
            .mapValues { (_, valuesForToken) ->
                valuesForToken.firstOrNull { it.mode == mode } ?: valuesForToken.first()
            }

        return tokens.map { token -> TokenWithValue(token = token, value = values[token.id]) }
    }
}
