package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.IconCatalogLoadId
import java.time.Instant

/** Запись журнала загрузок каталога. */
data class IconCatalogLoad(
    /** Идентификатор загрузки. */
    val loadId: IconCatalogLoadId,
    /** Имя пакета-источника. */
    val packageName: String,
    /** Версия пакета-источника. */
    val packageVersion: String,
    /** Число иконок. */
    val iconCount: Int,
    /** Кто загрузил. */
    val loadedBy: String,
    /** Когда загружено. */
    val loadedAt: Instant,
    /** Активна ли загрузка. */
    val active: Boolean,
)
