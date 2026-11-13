package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.IconAssetStorage
import com.dsbuilder.ds.components.application.StoredIconLoad
import com.dsbuilder.ds.components.domain.IconAsset
import com.dsbuilder.ds.components.domain.IconCatalogLoadId
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.Delete
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request
import software.amazon.awssdk.services.s3.model.ObjectIdentifier
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.model.S3Object

/**
 * S3-совместимое хранилище SVG иконок; ключи лежат под `<iconsPrefix>/<loadId>/<size>/<Name>.svg`.
 *
 * Префикс задаётся явно: по умолчанию это `<префикс плагина>/icons`, но иконки можно положить и рядом с плагинами
 * (например `static/icons`). Он обязателен: пустой префикс означал бы корень бакета. Список и очистка затрагивают
 * только каталоги, имя которых похоже на идентификатор загрузки (12 шестнадцатеричных символов), поэтому соседние
 * каталоги плагинов (`builds/` и другие) не удаляются, даже если префикс иконок их содержит.
 */
class S3IconAssetStorage(
    private val client: S3Client,
    private val bucket: String,
    iconsPrefix: String,
) : IconAssetStorage {
    private val root = iconsPrefix.trim('/').also { require(it.isNotEmpty()) { "Префикс иконок не задан" } } + "/"

    override val configured: Boolean = true

    override suspend fun put(loadId: IconCatalogLoadId, asset: IconAsset) {
        withContext(Dispatchers.IO) {
            client.putObject(
                PutObjectRequest.builder()
                    .bucket(bucket)
                    .key("$root${loadId.value}/${asset.size.px}/${asset.name}.svg")
                    .contentType(CONTENT_TYPE)
                    .cacheControl(IMMUTABLE_CACHE_CONTROL)
                    .build(),
                RequestBody.fromBytes(asset.svg.toByteArray(Charsets.UTF_8)),
            )
        }
    }

    override suspend fun listLoads(): List<StoredIconLoad> = withContext(Dispatchers.IO) {
        objects(root).groupBy { it.key().removePrefix(root).substringBefore('/') }
            .filterKeys { LOAD_DIRECTORY.matches(it) }
            .map { (id, files) -> StoredIconLoad(id, files.maxOf { it.lastModified() }) }
    }

    override suspend fun deleteLoad(loadId: String) {
        require(LOAD_DIRECTORY.matches(loadId)) { "Не идентификатор загрузки: $loadId" }
        withContext(Dispatchers.IO) {
            objects("$root$loadId/").map { it.key() }.chunked(DELETE_BATCH).forEach { keys ->
                val identifiers = keys.map { ObjectIdentifier.builder().key(it).build() }
                client.deleteObjects(
                    DeleteObjectsRequest.builder().bucket(bucket)
                        .delete(Delete.builder().objects(identifiers).build())
                        .build(),
                )
            }
        }
    }

    private fun objects(prefix: String): List<S3Object> =
        client.listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build())
            .contents().toList()

    private companion object {
        const val DELETE_BATCH = 1_000
        private val LOAD_DIRECTORY = Regex("[0-9a-f]{12}")
        const val CONTENT_TYPE = "image/svg+xml"
        const val IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"
    }
}
