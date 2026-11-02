package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.PreviewPluginPlatform

/**
 * Хранилища билдов по платформам. У каждой платформы свои бакет и префикс, поэтому очистка одной платформы
 * не видит файлов другой.
 */
class PluginBuildStorages(private val byPlatform: Map<PreviewPluginPlatform, PluginBuildStorageBinding>) {
    /** Хранилище и настройки [platform], если хранилище платформы настроено; иначе `null`. */
    fun configured(platform: PreviewPluginPlatform): PluginBuildStorageBinding? =
        byPlatform[platform]?.takeIf { it.storage.configured }

    /** Лимиты архива [platform]; они общие для платформ и действуют и без настроенного хранилища. */
    fun limits(platform: PreviewPluginPlatform): PluginArchiveLimits =
        byPlatform[platform]?.settings?.limits ?: PluginArchiveLimits()
}
