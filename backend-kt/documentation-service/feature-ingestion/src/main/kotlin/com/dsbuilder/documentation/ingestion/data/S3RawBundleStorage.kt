package com.dsbuilder.documentation.ingestion.data

import com.dsbuilder.documentation.ingestion.application.BundleSource
import com.dsbuilder.documentation.ingestion.application.RawBundleStorage
import com.dsbuilder.documentation.ingestion.application.StoredBundle
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest
import software.amazon.awssdk.services.s3.model.HeadBucketRequest
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import java.nio.file.Path

/** S3-compatible immutable storage исходных compressed bundles. */
class S3RawBundleStorage(private val client: S3Client, private val bucket: String, prefix: String) : RawBundleStorage {
    private val prefix = prefix.trim('/')

    override suspend fun put(
        source: BundleSource,
        projectId: String,
        bundleId: String,
    ): StoredBundle = withContext(Dispatchers.IO) {
        val relative = "projects/$projectId/documentation/bundles/$bundleId/bundle.tar.gz"
        val key = if (prefix.isEmpty()) relative else "$prefix/$relative"
        client.putObject(
            PutObjectRequest.builder().bucket(bucket).key(key).contentLength(source.compressedSize)
                .metadata(mapOf("sha256" to source.sha256)).ifNoneMatch("*").build(),
            RequestBody.fromFile(Path.of(source.location)),
        )
        StoredBundle(bucket, key)
    }

    override suspend fun delete(stored: StoredBundle) = withContext(Dispatchers.IO) {
        client.deleteObject(DeleteObjectRequest.builder().bucket(stored.bucket).key(stored.key).build())
        Unit
    }

    /** Проверяет доступность заранее созданного bucket. */
    suspend fun isReady(): Boolean = withContext(Dispatchers.IO) {
        try {
            client.headBucket(HeadBucketRequest.builder().bucket(bucket).build())
            true
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            false
        }
    }
}
