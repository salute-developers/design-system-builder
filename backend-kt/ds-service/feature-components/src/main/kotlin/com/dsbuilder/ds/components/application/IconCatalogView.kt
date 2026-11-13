package com.dsbuilder.ds.components.application

/** Каталог для чтения клиентом. */
data class IconCatalogView(
    /** Активная загрузка. */
    val load: IconCatalogLoad?,
    /** Базовый адрес SVG; пусто, если каталога нет. */
    val assetsBaseUrl: String?,
    /** Иконки. */
    val icons: List<com.dsbuilder.ds.components.domain.IconEntry>,
)
