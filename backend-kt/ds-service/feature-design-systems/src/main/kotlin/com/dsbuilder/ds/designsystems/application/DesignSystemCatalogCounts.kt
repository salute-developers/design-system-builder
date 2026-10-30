package com.dsbuilder.ds.designsystems.application

/** Прикладная граница пакетного подсчёта для доверенного каталога проектов монолита. */
fun interface DesignSystemCatalogCounts {
    /** Считает нетехнические системы не более 500 уже авторизованных проектов. */
    suspend fun count(projectIds: List<String>): Map<String, Int>
}
