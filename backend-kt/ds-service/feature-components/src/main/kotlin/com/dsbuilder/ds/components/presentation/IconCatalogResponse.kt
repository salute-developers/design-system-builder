package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.application.IconCatalogView
import com.dsbuilder.ds.components.domain.IconSize
import kotlinx.serialization.Serializable

/** Ответ чтения каталога. */
@Serializable
data class IconCatalogResponse(
    /** Источник; `null`, если каталог не загружался. */
    val source: IconCatalogSourceDto?,
    /** Базовый адрес SVG: `<assetsBaseUrl>/<size>/<name>.svg`; `null` без каталога. */
    val assetsBaseUrl: String?,
    /** Иконки. */
    val icons: List<IconDto>,
) {
    /** Сборка ответа. */
    companion object {
        /** Преобразует каталог в ответ. */
        fun from(view: IconCatalogView) = IconCatalogResponse(
            source = view.load?.let {
                IconCatalogSourceDto(it.packageName, it.packageVersion, it.loadedAt.toString(), it.loadId.value)
            },
            assetsBaseUrl = view.assetsBaseUrl,
            icons = view.icons.map {
                val sizes = it.sizes.map(IconSize::px).sorted()
                IconDto(it.name, it.style.wire, sizes, it.legacyKey, it.category, it.aliases)
            },
        )
    }
}
