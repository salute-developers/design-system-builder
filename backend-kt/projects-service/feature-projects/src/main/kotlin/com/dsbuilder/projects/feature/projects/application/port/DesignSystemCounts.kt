package com.dsbuilder.projects.feature.projects.application.port

/** Пакетное чтение количеств только для проектов, уже разрешённых каталогом. */
fun interface DesignSystemCounts {
    /** Неизвестное количество отсутствует в результате; подтверждённое отсутствие ДС — ноль. */
    suspend fun count(projectIds: List<String>): Map<String, Int>
}
