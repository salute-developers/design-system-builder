package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.application.IconUpload
import com.dsbuilder.ds.components.application.PublishIconCatalog
import com.dsbuilder.ds.components.domain.IconSize
import kotlinx.serialization.Serializable

/** Тело загрузки каталога. */
@Serializable
data class PublishIconCatalogRequest(
    /** Версия схемы манифеста, сейчас `1`. */
    val schemaVersion: Int,
    /** Пакет-источник. */
    val source: IconSourceDto,
    /** Иконки. */
    val icons: List<IconUploadDto>,
) {
    /** Преобразует тело в команду; неизвестная версия схемы или ключ размера дают исключение. */
    fun toCommand(dryRun: Boolean, allowRemovingUsed: Boolean): PublishIconCatalog {
        require(schemaVersion == SCHEMA_VERSION) { "Unknown schemaVersion" }
        val uploads = icons.map { icon ->
            IconUpload(icon.name, icon.category, icon.aliases, icon.sizes.mapKeys { SIZES.getValue(it.key) })
        }
        return PublishIconCatalog(source.packageName, source.version, uploads, dryRun, allowRemovingUsed)
    }
}

private const val SCHEMA_VERSION = 1

private val SIZES = IconSize.entries.associateBy { it.px.toString() }
