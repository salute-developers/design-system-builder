package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.IconCatalogLoadId

/** Данные новой строки журнала. */
data class NewIconCatalogLoad(
    /** Идентификатор загрузки. */
    val loadId: IconCatalogLoadId,
    /** Имя пакета-источника. */
    val packageName: String,
    /** Версия пакета-источника. */
    val packageVersion: String,
    /** Кто загрузил. */
    val loadedBy: String,
)
