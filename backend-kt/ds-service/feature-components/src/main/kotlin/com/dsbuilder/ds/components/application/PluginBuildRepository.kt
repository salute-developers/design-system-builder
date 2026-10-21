package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.NewPluginBuild
import com.dsbuilder.ds.components.domain.PluginBuild

/** Реестр билдов плагина в БД. */
interface PluginBuildRepository {
    /**
     * Берёт эксклюзивную блокировку на время текущей транзакции: публикации, активации и очистки билдов
     * выполняются строго по одной, поэтому файлы билда и его строка не расходятся при параллельных запросах.
     */
    suspend fun lockPublications()

    /** Билд по идентификатору. */
    suspend fun find(buildId: String): PluginBuild?

    /** Активный билд платформы. */
    suspend fun active(platform: String): PluginBuild?

    /** Все билды платформы от самого нового к самому старому. */
    suspend fun listByRecency(platform: String): List<PluginBuild>

    /** Записывает новый билд и делает его единственным активным билдом платформы. */
    suspend fun insertActive(build: NewPluginBuild): PluginBuild

    /** Делает существующий билд единственным активным билдом платформы. */
    suspend fun activate(buildId: String): PluginBuild

    /** Удаляет строку билда. */
    suspend fun delete(buildId: String)
}
