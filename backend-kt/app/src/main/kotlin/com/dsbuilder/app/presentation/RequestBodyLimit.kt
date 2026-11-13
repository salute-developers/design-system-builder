package com.dsbuilder.app.presentation

import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.hooks.CallFailed
import io.ktor.server.application.hooks.ResponseSent
import io.ktor.util.AttributeKey
import io.ktor.utils.io.ByteChannel
import io.ktor.utils.io.readAvailable
import io.ktor.utils.io.writeFully
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

internal val requestLimitKey = AttributeKey<Long>("backend.request.limit")

/** Превышение фактически прочитанного объёма, включая chunked-запросы. */
class RequestBodyTooLarge : IllegalStateException("Request body exceeds the route limit")

private val bodyJobKey = AttributeKey<kotlinx.coroutines.Job>("backend.request.body.job")
private val bodyExceededKey = AttributeKey<Boolean>("backend.request.body.exceeded")

/** Ограничивает поток до десериализации и записи архива. */
// Ошибка чтения передаётся потребителю канала без изменения, независимо от её типа.
@Suppress("TooGenericExceptionCaught")
val RequestBodyLimit = createApplicationPlugin("BackendRequestBodyLimit") {
    val owner = application
    onCallReceive { call ->
        transformBody { body ->
            val limit = call.attributes.getOrNull(requestLimitKey)
            if (limit == null || call.attributes.contains(bodyJobKey)) {
                return@transformBody body
            }
            val bounded = ByteChannel(autoFlush = true)
            val job = owner.launch(Dispatchers.IO) {
                try {
                    val buffer = ByteArray(8192)
                    var read = 0L
                    while (true) {
                        val size = body.readAvailable(buffer)
                        if (size < 0) break
                        read += size
                        if (read > limit) {
                            call.attributes.put(bodyExceededKey, true)
                            throw RequestBodyTooLarge()
                        }
                        bounded.writeFully(buffer, 0, size)
                    }
                    bounded.flushAndClose()
                } catch (error: Throwable) {
                    bounded.cancel(error)
                } finally {
                    body.cancel(null)
                }
            }
            call.attributes.put(bodyJobKey, job)
            bounded
        }
    }
    onCallRespond { call, _ ->
        if (call.attributes.getOrNull(bodyExceededKey) == true) {
            call.response.status(HttpStatusCode.PayloadTooLarge)
            transformBody { TextContent("", ContentType.Text.Plain, HttpStatusCode.PayloadTooLarge) }
        }
    }
    on(ResponseSent) { call -> call.attributes.getOrNull(bodyJobKey)?.cancel() }
    on(CallFailed) { call, cause ->
        call.attributes.getOrNull(bodyJobKey)?.cancel()
        throw cause
    }
}
