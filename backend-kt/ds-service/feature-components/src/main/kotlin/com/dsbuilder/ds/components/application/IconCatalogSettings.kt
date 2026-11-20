package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.IconCatalogLoadId
import java.time.Duration

/** Настройки каталога иконок, заданные окружением. */
data class IconCatalogSettings(
    /** Публичный адрес каталога иконок в бакете, без завершающего `/`: под ним лежат каталоги загрузок. */
    val publicBaseUrl: String,
    /** Сколько предыдущих загрузок хранить кроме активной. */
    val keepLoads: Int = DEFAULT_KEEP_LOADS,
    /** Через сколько файлы без строки в БД считаются осиротевшими. */
    val orphanGrace: Duration = DEFAULT_ORPHAN_GRACE,
) {
    /** Базовый адрес SVG загрузки: `<base>/<size>/<Name>.svg`, без завершающего `/`. */
    fun assetsBaseUrl(loadId: IconCatalogLoadId): String = "${publicBaseUrl.trimEnd('/')}/${loadId.value}"

    /** Значения по умолчанию. */
    companion object {
        /** Три предыдущие загрузки. */
        const val DEFAULT_KEEP_LOADS = 3

        /** 24 часа. */
        val DEFAULT_ORPHAN_GRACE: Duration = Duration.ofHours(24)
    }
}
