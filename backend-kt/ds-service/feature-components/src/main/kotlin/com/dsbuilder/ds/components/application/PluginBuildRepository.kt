package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.NewPluginBuild
import com.dsbuilder.ds.components.domain.PluginBuild
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult

/** Реестр билдов плагина в БД. */
interface PluginBuildRepository {
    /**
     * Берёт эксклюзивную блокировку на время текущей транзакции: публикации, активации и очистки билдов
     * выполняются строго по одной, поэтому файлы билда и его строка не расходятся при параллельных запросах.
     * Вызывается первой операцией БД в изменяющей транзакции.
     */
    suspend fun lockPublications()

    /** Билд по идентификатору. */
    suspend fun find(buildId: String): PluginBuild?

    /** Активный билд платформы. */
    suspend fun active(platform: String): PluginBuild?

    /** Совместимая сборка черновика либо точный buildId опубликованной версии. */
    suspend fun selected(platform: String, versionId: java.util.UUID?): PluginBuild? = null

    /** Все билды платформы от самого нового к самому старому. */
    suspend fun listByRecency(platform: String): List<PluginBuild>

    /** Записывает новый билд и делает его единственным активным билдом платформы. */
    suspend fun insertActive(build: NewPluginBuild): PluginBuild

    /** Проверяет неизменный dev-Core и отсутствие исторического закрепления под барьером Core. */
    suspend fun validateReplacement(build: NewPluginBuild): DsResult<Unit> =
        DsResult.Failure(
            DsFailure.Conflict("BUILD_CONTENT_CHANGED"),
        )

    /** Атомарно заменяет метаданные и каталог проверенной полной редакции. */
    suspend fun replaceActive(build: NewPluginBuild): PluginBuild = error("Replacement is not supported")

    /** Делает существующий билд единственным активным билдом платформы. */
    suspend fun activate(buildId: String): PluginBuild

    /** Удаляет строку билда. */
    suspend fun delete(buildId: String)

    /** Повторно проверяет закрепление под барьером выбора Core и удаляет только свободную сборку. */
    suspend fun deleteIfUnpinned(buildId: String): Boolean {
        if (buildId in pinnedBuildIds()) return false
        delete(buildId)
        return true
    }

    /** Сборки, закреплённые опубликованными версиями ДС и защищённые от очистки. */
    suspend fun pinnedBuildIds(): Set<String> = emptySet()
}
