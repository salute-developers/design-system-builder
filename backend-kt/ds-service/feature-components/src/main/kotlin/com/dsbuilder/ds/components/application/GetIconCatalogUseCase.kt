package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Выдаёт общедоступный активный каталог иконок без проектного контекста. */
class GetIconCatalogUseCase(
    private val transactions: TransactionRunner,
    private val catalog: IconCatalogRepository,
    private val settings: IconCatalogSettings,
) {
    /** Без загруженного каталога возвращает пустой список без источника. */
    suspend fun execute(): DsResult<IconCatalogView> = transactions.readOnly {
        val load = catalog.loadsByRecency().firstOrNull { it.active }
        DsResult.Success(IconCatalogView(load, load?.let { settings.assetsBaseUrl(it.loadId) }, catalog.entries()))
    }
}
