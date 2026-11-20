package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.IconAssetStorage
import com.dsbuilder.ds.components.domain.IconAsset
import com.dsbuilder.ds.components.domain.IconCatalogLoadId

/** Хранилище не настроено: загрузка каталога недоступна. */
object DisabledIconAssetStorage : IconAssetStorage {
    override val configured: Boolean = false

    override suspend fun put(loadId: IconCatalogLoadId, asset: IconAsset) = error("Icon storage is not configured")
}
