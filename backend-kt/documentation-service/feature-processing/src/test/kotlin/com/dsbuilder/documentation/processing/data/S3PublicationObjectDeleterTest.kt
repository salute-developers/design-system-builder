package com.dsbuilder.documentation.processing.data

import com.dsbuilder.documentation.processing.domain.StoredObjectDescriptor
import kotlinx.coroutines.runBlocking
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest
import software.amazon.awssdk.services.s3.model.DeleteObjectsResponse
import java.lang.reflect.Proxy
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class S3PublicationObjectDeleterTest {
    @Test
    fun `deletes only explicit keys and treats empty delete response as success`() = runBlocking {
        val requests = mutableListOf<DeleteObjectsRequest>()
        val client = Proxy.newProxyInstance(
            S3Client::class.java.classLoader,
            arrayOf(S3Client::class.java),
        ) { _, method, arguments ->
            when (method.name) {
                "deleteObjects" -> {
                    requests += arguments.single() as DeleteObjectsRequest
                    DeleteObjectsResponse.builder().build()
                }
                "serviceName" -> "s3"
                "close" -> Unit
                else -> error("Unexpected S3 call ${method.name}")
            }
        } as S3Client
        val objects = listOf(
            StoredObjectDescriptor("bucket-a", "exact/a", 10),
            StoredObjectDescriptor("bucket-a", "exact/b", 20),
            StoredObjectDescriptor("bucket-b", "raw/bundle", 30),
        )

        val deleted = S3PublicationObjectDeleter(client).delete(objects)

        assertEquals(3, deleted.count)
        assertEquals(60, deleted.bytes)
        assertEquals(setOf("bucket-a", "bucket-b"), requests.map { it.bucket() }.toSet())
        assertEquals(
            objects.map { it.key }.toSet(),
            requests.flatMap { it.delete().objects() }.map { it.key() }.toSet(),
        )
        assertTrue(requests.all { it.delete().quiet() })
    }
}
