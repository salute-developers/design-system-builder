package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.PluginBuildStorage
import com.dsbuilder.ds.components.application.StoredPluginBuild

/** Хранилище не настроено: публикация недоступна. */
object DisabledPluginBuildStorage : PluginBuildStorage {
    override val configured: Boolean = false

    override suspend fun putFile(
        buildId: String,
        path: String,
        bytes: ByteArray,
        contentType: String,
        cacheControl: String,
    ) = error("Plugin storage is not configured")

    override suspend fun listBuilds(): List<StoredPluginBuild> = emptyList()

    override suspend fun deleteBuild(buildId: String) = error("Plugin storage is not configured")
}
