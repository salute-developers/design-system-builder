package com.dsbuilder.ds.components.application

/** Объектное хранилище файлов билдов плагина. */
interface PluginBuildStorage {
    /** Настроено ли хранилище; без настройки публикация недоступна. */
    val configured: Boolean

    /** Записывает один файл билда с заданными заголовками. */
    suspend fun putFile(buildId: String, path: String, bytes: ByteArray, contentType: String, cacheControl: String)

    /** Каталоги билдов, которые есть в хранилище. */
    suspend fun listBuilds(): List<StoredPluginBuild>

    /** Удаляет каталог билда целиком. */
    suspend fun deleteBuild(buildId: String)
}
