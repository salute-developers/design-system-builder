package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.IconAsset
import com.dsbuilder.ds.components.domain.IconCatalogLoadId

/** Объектное хранилище SVG каталога иконок. */
interface IconAssetStorage {
    /** Настроено ли хранилище; без настройки загрузка каталога недоступна. */
    val configured: Boolean

    /** Записывает SVG; ключ `<prefix>/icons/<loadId>/<size>/<Name>.svg`. */
    suspend fun put(loadId: IconCatalogLoadId, asset: IconAsset)

    /** Загрузки, файлы которых есть в хранилище. */
    suspend fun listLoads(): List<StoredIconLoad> = emptyList()

    /** Удаляет файлы загрузки целиком. */
    suspend fun deleteLoad(loadId: String) = Unit
}
