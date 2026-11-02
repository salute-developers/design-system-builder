package com.dsbuilder.app.presentation

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respondText
import io.ktor.util.AttributeKey
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.selects.select

private val publicationBodyKey = AttributeKey<CompletableDeferred<Unit>>("backend.plugin.body.completed")

/** Начинает ожидание ответа публикации после приёма архива, сохраняя активные загрузки. */
internal suspend fun publicationTimeout(call: ApplicationCall, timeoutMs: Long, operation: suspend () -> Unit) {
    val bodyConsumed = CompletableDeferred<Unit>()
    call.attributes.put(publicationBodyKey, bodyConsumed)
    coroutineScope {
        val action = async { operation() }
        val deadline = async {
            bodyConsumed.await()
            delay(timeoutMs)
        }
        try {
            select {
                action.onAwait { }
                deadline.onAwait {
                    action.cancel()
                    if (!call.response.isCommitted) {
                        call.respondText("", status = HttpStatusCode.GatewayTimeout)
                    }
                }
            }
        } finally {
            deadline.cancel()
            action.cancel()
        }
    }
}

/** Сигнал presentation-слоя DS об окончании приёма тела публикации. */
fun ApplicationCall.pluginPublicationBodyConsumed() {
    attributes.getOrNull(publicationBodyKey)?.complete(Unit)
}
