package com.dsbuilder.ds.themes.application

import com.dsbuilder.ds.themes.domain.Tenant
import com.dsbuilder.ds.themes.domain.TenantTokenValueInput

/** Инициализирует значения токенов для только что созданной темы. */
interface TenantTokenValueInitializer {
    /**
     * Создаёт начальный набор значений для [tenant]: значения профиля, которые [values] заменяют для своих комбинаций
     * `tokenId + platform + mode`. Возвращает `false` и ничего не записывает, если среди [values] есть токен не из
     * дизайн-системы темы.
     */
    suspend fun initialize(tenant: Tenant, values: List<TenantTokenValueInput> = emptyList()): Boolean
}
