package com.dsbuilder.documentation.ingestion.application

/** Ссылка на сохраненный raw object. */
data class StoredBundle(
    /** Имя bucket. */
    val bucket: String,
    /** Ключ объекта. */
    val key: String,
)

/** Хранилище неизменяемых raw archives. */
interface RawBundleStorage {
    /** Сохраняет raw bundle. */
    suspend fun put(source: BundleSource, projectId: String, bundleId: String): StoredBundle

    /** Удаляет raw bundle. */
    suspend fun delete(stored: StoredBundle)
}
