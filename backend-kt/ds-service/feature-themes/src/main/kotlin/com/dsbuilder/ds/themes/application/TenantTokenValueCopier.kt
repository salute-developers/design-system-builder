package com.dsbuilder.ds.themes.application

import com.dsbuilder.ds.themes.domain.Tenant

/** Копирует значения токенов одной темы в другую тему той же дизайн-системы; вызывается внутри транзакции. */
interface TenantTokenValueCopier {
    /**
     * Записывает в [target] значения всех токенов [source] активного черновика: все платформы и режимы, ссылки на
     * палитру и признак своего значения платформы. [target] не должна иметь значений.
     */
    suspend fun copy(source: Tenant, target: Tenant)
}
