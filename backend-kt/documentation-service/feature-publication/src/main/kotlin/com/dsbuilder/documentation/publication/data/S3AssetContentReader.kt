package com.dsbuilder.documentation.publication.data

import com.dsbuilder.documentation.publication.application.AssetContentReader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import java.io.OutputStream

/** Потоково читает опубликованные assets из S3-compatible storage. */
class S3AssetContentReader(
    private val client: S3Client,
    private val bucket: String,
) : AssetContentReader {
    override suspend fun copyTo(storageKey: String, output: OutputStream) = withContext(Dispatchers.IO) {
        val request = GetObjectRequest.builder().bucket(bucket).key(storageKey).build()
        client.getObject(request).use { input -> input.copyTo(output) }
        Unit
    }
}
