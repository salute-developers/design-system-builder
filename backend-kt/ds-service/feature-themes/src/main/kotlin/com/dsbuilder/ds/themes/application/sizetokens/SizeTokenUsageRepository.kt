package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.sizetokens.ComponentUsage
import com.dsbuilder.ds.themes.domain.sizetokens.RadiusOffset
import java.util.UUID

/**
 * Использование токенов в конфигурациях компонентов дизайн-системы на границе транзакции. Значение свойства
 * ссылается на токен через `token_id` или текстом, равным имени токена; значения и поправки читаются из редакций
 * конфигураций компонентов, действующих на той же границе, что и токены.
 */
interface SizeTokenUsageRepository {
    /** Имя токена из [tokens] (идентификатор → имя) → компоненты [designSystemId] и число значений их свойств. */
    suspend fun usage(designSystemId: UUID, tokens: Map<UUID, String>): Map<String, List<ComponentUsage>>

    /**
     * Имя токена из [tokens] → смещения ссылок компонентов [designSystemId]: `adjustment` строки значения или
     * числовая поправка платформенного параметра (web, затем xml, compose, ios).
     */
    suspend fun adjustments(designSystemId: UUID, tokens: Map<UUID, String>): Map<String, List<RadiusOffset>>
}
