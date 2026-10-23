package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.PluginBuildStorage
import com.dsbuilder.ds.components.application.StoredPluginBuild
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
import java.time.Instant

/** S3-совместимое хранилище файлов билдов плагина; все ключи лежат под `<prefix>/builds/<buildId>/`. */
class S3PluginBuildStorage(
    private val client: S3Client,
    private val bucket: String,
    prefix: String,
) : PluginBuildStorage {
    private val root = prefix.trim('/').let { if (it.isEmpty()) "builds/" else "$it/builds/" }

    override val configured: Boolean = true

    override suspend fun putFile(
        buildId: String,
        path: String,
        bytes: ByteArray,
        contentType: String,
        cacheControl: String,
    ) {
        withContext(Dispatchers.IO) {
            client.putObject(
                PutObjectRequest.builder()
                    .bucket(bucket)
                    .key("$root$buildId/$path")
                    .contentType(contentType)
                    .cacheControl(cacheControl)
                    .build(),
                RequestBody.fromBytes(bytes),
            )
        }
    }

    override suspend fun listBuilds(): List<StoredPluginBuild> = withContext(Dispatchers.IO) {
        val latest = linkedMapOf<String, Instant>()
        objects(root).forEach { obj ->
            val buildId = obj.key().removePrefix(root).substringBefore('/')
            if (buildId.isNotEmpty()) latest.merge(buildId, obj.lastModified()) { a, b -> if (a.isAfter(b)) a else b }
        }
        latest.map { (id, modified) -> StoredPluginBuild(id, modified) }
    }

    override suspend fun deleteBuild(buildId: String) {
        withContext(Dispatchers.IO) {
            objects("$root$buildId/").map { it.key() }.chunked(DELETE_BATCH).forEach { keys ->
                val identifiers = keys.map { ObjectIdentifier.builder().key(it).build() }
                client.deleteObjects(
                    DeleteObjectsRequest.builder().bucket(bucket)
                        .delete(Delete.builder().objects(identifiers).build())
                        .build(),
                )
            }
        }
    }

    private fun objects(prefix: String): List<S3Object> {
        val found = mutableListOf<S3Object>()
        var token: String? = null
        do {
            val page = client.listObjectsV2(
                ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).continuationToken(token).build(),
            )
            found += page.contents()
            token = page.nextContinuationToken()
        } while (page.isTruncated == true && token != null)
        return found
    }

    private companion object {
        const val DELETE_BATCH = 1_000
    }
}
