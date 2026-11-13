package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Выдаёт активный каталог иконок участнику проекта с правом чтения компонентов. */
class GetIconCatalogUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val catalog: IconCatalogRepository,
    private val settings: IconCatalogSettings,
) {
    /** Выполняет сценарий; без загруженного каталога возвращает пустой список без источника. */
    suspend fun execute(context: DsRequestContext): DsResult<IconCatalogView> =
        policy.read(context, ProjectScope.COMPONENTS_READ) {
            transactions.readOnly(context) {
                val load = catalog.loadsByRecency().firstOrNull { it.active }
                DsResult.Success(
                    IconCatalogView(
                        load = load,
                        assetsBaseUrl = load?.let { settings.assetsBaseUrl(it.loadId) },
                        icons = catalog.entries(),
                    ),
                )
            }
        }
}
