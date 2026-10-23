package com.dsbuilder.ds.components.application

import java.time.Instant

/** Каталог билда в хранилище. */
data class StoredPluginBuild(
    /** Идентификатор билда. */
    val buildId: String,
    /** Время последнего изменения самого нового объекта каталога. */
    val lastModified: Instant,
)
