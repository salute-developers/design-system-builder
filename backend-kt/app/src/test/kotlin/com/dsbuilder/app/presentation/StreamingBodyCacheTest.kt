package com.dsbuilder.app.presentation

import com.dsbuilder.ds.app.DsMetrics
import com.dsbuilder.ds.app.installDsHttpPlugins
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.PartData
import io.ktor.http.content.forEachPart
import io.ktor.server.application.call
import io.ktor.server.request.receiveChannel
import io.ktor.server.request.receiveMultipart
import io.ktor.server.response.respondText
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.ktor.utils.io.readAvailable
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

class StreamingBodyCacheTest {
    @Test
    fun `large multipart is streamed once with actual monolith HTTP plugins`() = testApplication {
        application {
            installDsHttpPlugins(Json, DsMetrics(), ::cacheDsJsonBody)
            routing {
                post("/api/projects/p/documentation/upload") {
                    var received = 0L
                    call.receiveMultipart().forEachPart { part ->
                        if (part is PartData.FileItem) {
                            val channel = part.provider()
                            val buffer = ByteArray(8192)
                            while (true) {
                                val size = channel.readAvailable(buffer)
                                if (size < 0) break
                                received += size
                            }
                        }
                        part.dispose()
                    }
                    val canReplay = runCatching { call.receiveChannel() }.isSuccess
                    call.respondText("$received:$canReplay")
                }
            }
        }
        val size = 8 * 1024 * 1024
        val prefix = "--boundary\r\nContent-Disposition: form-data; name=\"bundle\"; filename=\"test.zip\"\r\n" +
            "Content-Type: application/zip\r\n\r\n"
        val response = client.post("/api/projects/p/documentation/upload") {
            header("Content-Type", "multipart/form-data; boundary=boundary")
            setBody(prefix.toByteArray() + ByteArray(size) { 42 } + "\r\n--boundary--\r\n".toByteArray())
        }
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("$size:false", response.bodyAsText())
    }
}
