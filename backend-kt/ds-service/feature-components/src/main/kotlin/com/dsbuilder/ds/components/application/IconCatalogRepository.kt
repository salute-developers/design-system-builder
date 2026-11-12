package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.IconCatalogLoadId
import com.dsbuilder.ds.components.domain.IconEntry

/** Хранилище каталога и журнала загрузок; работает в транзакции вызывающего кода. */
interface IconCatalogRepository {
    /** Блокирует публикацию каталога до конца транзакции. */
    suspend fun lockPublications()

    /** Записи текущего каталога, по имени. */
    suspend fun entries(): List<IconEntry>

    /** Журнал загрузок от новых к старым; активная загрузка помечена флагом. */
    suspend fun loadsByRecency(): List<IconCatalogLoad>

    /** Заменяет каталог записями [entries], добавляет или обновляет строку журнала и делает её активной. */
    suspend fun replaceActive(entries: List<IconEntry>, load: NewIconCatalogLoad)

    /** Удаляет строку журнала неактивной загрузки. */
    suspend fun deleteLoad(loadId: IconCatalogLoadId)
}
