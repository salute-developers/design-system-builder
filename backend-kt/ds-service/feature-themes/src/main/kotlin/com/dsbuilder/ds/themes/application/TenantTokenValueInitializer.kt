package com.dsbuilder.ds.themes.application

import com.dsbuilder.ds.themes.domain.Tenant

/** Инициализирует значения токенов для только что созданной темы. */
interface TenantTokenValueInitializer {
    /** Создаёт начальный набор значений для [tenant]. */
    suspend fun initialize(tenant: Tenant)
}
