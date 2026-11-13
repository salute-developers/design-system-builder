package com.dsbuilder.frontend.plugin.androidstudio.tokens

import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadErrorCode.AUTH_REQUIRED
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadResult.Failed
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadResult.Success
import com.dsbuilder.frontend.plugin.androidstudio.api.ApiRequestException
import com.dsbuilder.frontend.plugin.androidstudio.api.SessionExpiredException
import com.dsbuilder.frontend.feature.ds.application.ListDesignSystemsUseCase as SharedListDesignSystemsUseCase

/** Адаптирует общий каталог к экранной модели IDE с обновлением сессии. */
public class ListDesignSystemsUseCase(
    private val catalog: SharedListDesignSystemsUseCase,
    private val refresh: suspend () -> Boolean = { false },
) {
    /** Возвращает имена, ID и описания без отдельного HTTP-клиента IDE. */
    public suspend fun execute(projectId: String): List<DesignSystem> {
        var result = catalog.execute(projectId)
        if (result is Failed &&
            result.code == AUTH_REQUIRED && refresh()
        ) {
            result = catalog.execute(projectId)
        }
        return when (result) {
            is Success ->
                result.items.map { DesignSystem(it.id, it.name, it.description) }
            is Failed ->
                if (result.code == AUTH_REQUIRED) {
                    throw SessionExpiredException(result.message)
                } else {
                    throw ApiRequestException(result.message)
                }
        }
    }
}

/**
 * Возвращает токены выбранной дизайн-системы вместе со значением для выбранной платформы,
 * склеивая `tokens` и `token-values` на клиенте — REST-контракт их не соединяет.
 */
public class GetDesignSystemTokensUseCase(
    private val client: DesignSystemDataClient,
) {
    /**
     * Выполняет сценарий: токены [designSystemId], со значением для [platform], [mode] и
     * [tenantId], если оно есть. Токен может не зависеть от темы (значение с `mode == null`) —
     * такое значение берём, только если нет отдельного значения именно под [mode]. Фильтрация по
     * [tenantId] обязательна: дизайн-система может иметь несколько tenant с независимо
     * опубликованными значениями одного токена, и без неё выбор между ними был бы недетерминирован.
     */
    public suspend fun execute(
        projectId: String,
        designSystemId: String,
        platform: TokenPlatform,
        mode: TokenMode,
        tenantId: String,
    ): List<TokenWithValue> {
        val tokens = client.listTokens(projectId, designSystemId).filter { it.designSystemId == designSystemId }
        val values = client.listTokenValues(projectId, designSystemId)
            .filter { it.tenantId == tenantId && it.platform == platform && (it.mode == null || it.mode == mode) }
            .groupBy { it.tokenId }
            .mapValues { (_, valuesForToken) ->
                valuesForToken.firstOrNull { it.mode == mode } ?: valuesForToken.first()
            }

        return tokens.map { token -> TokenWithValue(token = token, value = values[token.id]) }
    }
}
