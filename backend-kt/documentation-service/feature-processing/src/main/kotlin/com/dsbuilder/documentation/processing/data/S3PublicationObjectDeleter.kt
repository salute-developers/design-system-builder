package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.application.PublicationObjectDeleter
import com.dsbuilder.documentation.processing.domain.DeletedObjects
import com.dsbuilder.documentation.processing.domain.StoredObjectDescriptor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.Delete
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest
import software.amazon.awssdk.services.s3.model.ObjectIdentifier

/** Идемпотентно удаляет только явно переданные S3 object keys. */
class S3PublicationObjectDeleter(
    private val client: S3Client,
) : PublicationObjectDeleter {
    override suspend fun delete(objects: List<StoredObjectDescriptor>): DeletedObjects = withContext(Dispatchers.IO) {
        var count = 0
        var bytes = 0L
        objects.groupBy(StoredObjectDescriptor::bucket).forEach { (bucket, bucketObjects) ->
            bucketObjects.chunked(S3_DELETE_LIMIT).forEach { batch ->
                val response = client.deleteObjects(
                    DeleteObjectsRequest.builder()
                        .bucket(bucket)
                        .delete(
                            Delete.builder()
                                .quiet(true)
                                .objects(batch.map { ObjectIdentifier.builder().key(it.key).build() })
                                .build(),
                        )
                        .build(),
                )
                check(response.errors().isEmpty()) { "S3 rejected one or more exact object deletions" }
                count += batch.size
                bytes += batch.sumOf(StoredObjectDescriptor::size)
            }
        }
        DeletedObjects(count, bytes)
    }

    private companion object {
        const val S3_DELETE_LIMIT = 1_000
    }
}
