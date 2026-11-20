package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.IconAsset
import com.dsbuilder.ds.components.domain.IconCatalogLoadId
import com.dsbuilder.ds.components.domain.IconEntry

/** Запрос, прошедший проверки и приведённый к записям каталога. */
internal class PreparedIconCatalog(
    val entries: List<IconEntry>,
    val assets: List<IconAsset>,
    val loadId: IconCatalogLoadId,
)
